import { getSigningKeys } from "./utils/getSigningKeys";
import { Block } from "viem";
import { getNonce, getNonces } from "./utils/getNonce";
import AsyncLock from "./utils/asyncLock";
import { nanoid } from "nanoid";

type KeysManagerBlock = {
  hash: string;
  nonce: BigInt;
};

type NonceData = {
  jobId: string;
  isLoaded: boolean;
};

type KeysManagerSeed = {
  blockNumber: string;
  hash: string;
  nonce: BigInt;
}[];

type BlockWithNonce = {
  blockNumber: BigInt;
  nonce: BigInt;
  block: Block;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class KeysManager {
  private maxBatchSize: number = 100;
  private blocks: Map<BigInt, KeysManagerBlock>;
  private nonces: Map<BigInt, NonceData>;
  private stateLock = new AsyncLock();

  constructor(maxBatchSize: number, seed: KeysManagerSeed = []) {
    this.maxBatchSize = maxBatchSize;
    this.onChange = this.onChange.bind(this);
    this.cutOffFinalizedBlocks = this.cutOffFinalizedBlocks.bind(this);

    // TODO use seed to populate state??? Perhaps only finalized blocks because others could have been reorganized
    this.blocks = new Map<BigInt, KeysManagerBlock>();
    this.nonces = new Map<BigInt, NonceData>();
  }

  async onChange(changedBlocks: Block[], isReorg?: boolean) {
    let newBlocks: Block[] = changedBlocks.filter((block) => {
      return !!block.number;
    });
    if (isReorg) {
      this.stateLock.acquire();
      try {
        // получаем нонсы для блоков
        const blockIds = newBlocks.map((block) => block.number as BigInt);
        const firstBlockInReorg = blockIds.reduce(
          (min: BigInt, current: BigInt) => (min < current ? min : current)
        );
        const lastBlockIdBeforeReorg: BigInt = BigInt(
          (firstBlockInReorg as bigint) - 1n
        ) as BigInt;

        const lastNonceBeforeReorg = this.blocks.get(lastBlockIdBeforeReorg)
          ?.nonce as BigInt;
        const newNonces = await getNonces(blockIds as BigInt[]);
        const staleNonces = [
          ...new Set(newNonces.map((item) => item.nonce)),
        ].filter((nonce) => nonce > lastNonceBeforeReorg);

        // delete stale nonces from state
        for (const nonce of staleNonces) {
          this.nonces.delete(nonce);
        }
        // TODO delete stale nonces from db
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
      await getNonces(blockIds as BigInt[])
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
          .at(0)?.blockNumber as BigInt;
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
    nonce: BigInt,
    blockNumber: BigInt,
    jobId: string
  ) {
    const keys = await getSigningKeys({
      blockNumber: blockNumber.valueOf(),
      maxBatchSize: this.maxBatchSize,
    });
    console.log(
      `Got ${keys.length} keys for nonce ${nonce}, jobId ${jobId} and block ${blockNumber}`
    );

    this.stateLock.acquire();
    try {
      // check if nonce is still in state and has the same jobId
      if (!this.nonces.has(nonce)) return;
      const nonceData = this.nonces.get(nonce);
      if (nonceData?.jobId !== jobId) return;
      // TODO save nonce and keys to db
      this.nonces.set(nonce, { jobId, isLoaded: true });
      console.log(
        `Succesfully saved keys for nonce ${nonce}, jobId ${jobId} and block ${blockNumber}`
      );
    } finally {
      this.stateLock.release();
    }
  }
  private async _saveBlock(block: Block, nonce: BigInt, jobId: string) {
    try {
      let status = "waiting";

      while (status === "waiting") {
        const nonceData = this.nonces.get(nonce);
        if (nonceData?.isLoaded && nonceData?.jobId === jobId) {
          status = "loaded";
          continue;
        }
        await delay(1000);
      }
      if (status !== "loaded") {
        return;
      }
      this.stateLock.acquire();
      try {
        // check if nonce is still in state and has the same jobId
        if (!this.nonces.has(nonce)) return;
        const nonceData = this.nonces.get(nonce);
        if (nonceData?.jobId !== jobId) return;

        // TODO save block to db

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

  async cutOffFinalizedBlocks(blocksToRemove: bigint[]) {
    console.log("Cutting off finalized blocks...", blocksToRemove);
    for (const blockNumber of blocksToRemove) {
      // await storage.del(blockNumber.toString());
    }
  }
}
