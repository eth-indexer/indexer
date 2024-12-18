import { getSigningKeys } from "./utils/getSigningKeys";
import { Block } from "viem";
import { getNonces } from "./utils/getNonce";
import AsyncLock from "./utils/asyncLock";
import { nanoid } from "nanoid";
import prisma from "./db/prisma";

type KeysManagerBlock = {
  hash: string;
  nonce: bigint;
};

type NonceData = {
  jobId: string;
  isLoaded: boolean;
};

type KeysManagerSeed = {
  blockNumber: string;
  hash: string;
  nonce: bigint;
}[];

type BlockWithNonce = {
  blockNumber: bigint;
  nonce: bigint;
  block: Block;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const bigIntReplacer = (key: string, value: any): any => {
  if (typeof value === "bigint") {
    return value.toString() + "n";
  }
  return value;
};

const bigIntReviver = (key: string, value: any): any => {
  if (typeof value === "string" && /^\d+n$/.test(value)) {
    return BigInt(value.slice(0, -1));
  }
  return value;
};

export class KeysManager {
  private maxBatchSize: number = 100;
  private blocks: Map<bigint, KeysManagerBlock>;
  private nonces: Map<bigint, NonceData>;
  private stateLock = new AsyncLock();

  constructor(maxBatchSize: number, seed: KeysManagerSeed = []) {
    this.maxBatchSize = maxBatchSize;
    this.onChange = this.onChange.bind(this);
    this.removeFinalizedBlocks = this.removeFinalizedBlocks.bind(this);

    // TODO use seed to populate state??? Perhaps only finalized blocks because others could have been reorganized
    this.blocks = new Map<bigint, KeysManagerBlock>();
    this.nonces = new Map<bigint, NonceData>();
  }

  async onChange(changedBlocks: Block[], isReorg?: boolean) {
    let newBlocks: Block[] = changedBlocks.filter((block) => {
      return !!block.number;
    });
    if (isReorg) {
      await this.stateLock.acquire();
      try {
        const blockIds = newBlocks.map((block) => block.number as bigint);
        const firstBlockInReorg = blockIds?.reduce(
          (min: bigint, current: bigint) => (min < current ? min : current),
          blockIds[0]
        );
        const lastBlockIdBeforeReorg: bigint = BigInt(
          (firstBlockInReorg as bigint) - 1n
        ) as bigint;

        const lastNonceBeforeReorg = this.blocks.get(lastBlockIdBeforeReorg)
          ?.nonce as bigint;
        const newNonces = await getNonces(blockIds as bigint[]);
        const staleNonces = [
          ...new Set(newNonces.map((item) => item.nonce)),
        ].filter((nonce) => nonce > lastNonceBeforeReorg);

        // delete stale nonces from state and db
        for (const nonce of staleNonces) {
          this.nonces.delete(nonce);
        }

        await prisma.keyState.deleteMany({
          where: {
            nonce: {
              in: staleNonces,
            },
          },
        });

        await prisma.block.deleteMany({
          where: {
            blockNumber: {
              gt: lastBlockIdBeforeReorg,
            },
          },
        });
      } finally {
        this.stateLock.release();
      }
    }

    newBlocks = newBlocks.filter((block) => {
      if (!block.number) return false;
      const newBlockNumber = block.number;
      if (!this.blocks.has(newBlockNumber)) {
        return true;
      }
      return this.blocks.get(newBlockNumber)?.hash !== block.hash; // Skip block if hash stays the same
    });

    const blockIds = newBlocks.map((block) => block.number);
    let blocksWithNonce: BlockWithNonce[] = (
      await getNonces(blockIds as bigint[])
    )
      .map((item) => {
        const block = newBlocks.find(
          (block) => block.number === item.blockNumber
        );
        if (!block) return null;
        return { ...item, block };
      })
      .filter(Boolean) as BlockWithNonce[];

    const nonces = [...new Set(blocksWithNonce.map((item) => item.nonce))];

    await this.stateLock.acquire();
    try {
      const noncesToLoad = nonces.filter((nonce) => !this.nonces.has(nonce));
      for (const nonce of noncesToLoad) {
        const jobId = nanoid();
        this.nonces.set(nonce, { jobId: jobId, isLoaded: false });
        const blockNumber = blocksWithNonce
          .filter((item) => item.nonce === nonce)
          .sort((a, b) => {
            return a.blockNumber < b.blockNumber
              ? -1
              : a.blockNumber > b.blockNumber
              ? 1
              : 0;
          })
          .at(0)?.blockNumber as bigint;
        this._addKeysForNonce(nonce, blockNumber, jobId);
      }

      for (const item of blocksWithNonce) {
        const { nonce, block, blockNumber } = item;
        const jobId = this.nonces.get(nonce)?.jobId as string;
        this.blocks.set(blockNumber, {
          hash: block.hash as `0x${string}`,
          nonce,
        });

        this._saveBlock(block, nonce, jobId);
      }
    } finally {
      this.stateLock.release();
    }
  }

  private async _addKeysForNonce(
    nonce: bigint,
    blockNumber: bigint,
    jobId: string
  ) {
    const keys = await getSigningKeys({
      blockNumber: blockNumber.valueOf(),
      maxBatchSize: this.maxBatchSize,
    });
    console.log(
      `Got ${keys.length} keys for nonce ${nonce}, jobId ${jobId} and block ${blockNumber}`
    );

    await this.stateLock.acquire();
    try {
      // check if nonce is still in state and has the same jobId
      if (!this.nonces.has(nonce)) return;
      const nonceData = this.nonces.get(nonce);
      if (nonceData?.jobId !== jobId) return;

      const keysString = JSON.stringify(keys, bigIntReplacer);

      await prisma.keyState.upsert({
        where: {
          nonce: nonce as bigint,
        },
        update: {
          keys: keysString,
        },
        create: {
          nonce: nonce as bigint,
          keys: keysString,
        },
      });

      this.nonces.set(nonce, { jobId, isLoaded: true });
      console.log(
        `Succesfully saved keys for nonce ${nonce}, jobId ${jobId} and block ${blockNumber}`
      );
    } finally {
      this.stateLock.release();
    }
  }
  private async _saveBlock(block: Block, nonce: bigint, jobId: string) {
    try {
      let status = "waiting";

      while (status === "waiting") {
        const nonceData = this.nonces.get(nonce);
        if (nonceData?.jobId !== jobId) {
          status = "canceled";
          continue;
        }
        if (nonceData?.isLoaded) {
          status = "loaded";
          continue;
        }
        await delay(1000);
      }
      if (status !== "loaded") {
        return;
      }

      await this.stateLock.acquire();
      try {
        // check if nonce is still in state and has the same jobId
        if (!this.nonces.has(nonce)) return;
        const nonceData = this.nonces.get(nonce);
        if (nonceData?.jobId !== jobId) return;

        const blockStateString = JSON.stringify(block, bigIntReplacer);

        await prisma.block.upsert({
          where: {
            blockNumber: block.number as bigint,
          },
          update: {
            blockHash: block.hash as `0x${string}`,
            parentBlockHash: block.parentHash as `0x${string}`,
            contractNonce: nonce as bigint,
            blockState: blockStateString,
          },
          create: {
            blockNumber: block.number as bigint,
            blockHash: block.hash as `0x${string}`,
            parentBlockHash: block.parentHash as `0x${string}`,
            contractNonce: nonce as bigint,
            blockState: blockStateString,
          },
        });

        console.log(
          `Saved block ${block.number} to db with nonce ${nonce} from jobId ${jobId}`
        );
      } finally {
        this.stateLock.release();
      }
    } catch (e) {
      console.error(e);
    }
  }

  async removeFinalizedBlocks(
    blocksToRemove: bigint[],
    lastFinalizedBlockNumber: bigint
  ) {
    console.log("Cutting off finalized blocks...", blocksToRemove);
    await this.stateLock.acquire();
    try {
      const blockNumbersToRemove = Array.from(this.blocks.keys()).filter(
        (blockNumber) => blockNumber < lastFinalizedBlockNumber
      );
      for (const blockNumber of blockNumbersToRemove) {
        this.blocks.delete(blockNumber);
      }
      await prisma.block.deleteMany({
        where: {
          blockNumber: {
            lt: lastFinalizedBlockNumber,
          },
        },
      });

      const noncesToRemove = Array.from(this.nonces.keys()).filter((nonce) => {
        const blockNumber = Array.from(this.blocks.keys()).find(
          (blockNumber) => this.blocks.get(blockNumber)?.nonce === nonce
        );
        return !blockNumber;
      });
      for (const nonce of noncesToRemove) {
        this.nonces.delete(nonce);
      }

      const largestNonceToRemove = noncesToRemove.reduce(
        (max, current) => (max > current ? max : current),
        noncesToRemove[0]
      );
      if (largestNonceToRemove) {
        await prisma.keyState.deleteMany({
          where: {
            nonce: {
              lte: largestNonceToRemove,
            },
          },
        });
      }
    } finally {
      this.stateLock.release();
    }
  }
}
