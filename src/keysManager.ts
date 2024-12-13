import { getSigningKeys } from "./utils/getSigningKeys";
import { redisInstance } from "./db/redisInstance";
import { Block } from "viem";
import { getNonce } from "./utils/getNonce";

export class KeysManager {
  private maxBatchSize: number = 100;

  constructor(maxBatchSize: number) {
    this.maxBatchSize = maxBatchSize;
    this.addKeysForBlock = this.addKeysForBlock.bind(this);
    this.cutOffFinalizedBlocks = this.cutOffFinalizedBlocks.bind(this);
  }

  async addKeysForBlock(block: Block) {
    const blockNumber = block.number;
    if (!blockNumber) return;

    const nonce = await getNonce(blockNumber);
    // TODO: check if nonce is already in the DB and skip if it is

    const keys = await getSigningKeys({
      blockNumber,
      maxBatchSize: this.maxBatchSize,
    });
    console.log(`Got ${keys.length} keys for block ${blockNumber}`);
    this.saveKeysToDB({ block, keys });
  }

  async cutOffFinalizedBlocks(blocksToRemove: bigint[]) {
    console.log("Cutting off finalized blocks...", blocksToRemove);
    for (const blockNumber of blocksToRemove) {
      await redisInstance.del(blockNumber.toString());
    }
  }

  private async saveKeysToDB({
    block,
    keys,
  }: {
    block: Block;
    keys: string[];
  }) {
    const blockNumber = block.number;
    if (!blockNumber) return;

    try {
      // @ts-ignore
      BigInt.prototype.toJSON = function () {
        // BigInt can't be serialized to JSON, so we need to convert it to number
        return Number(this);
      };
      await redisInstance.set(
        blockNumber.toString(),
        JSON.stringify({ keys, block })
      );
      console.log("Saved!");
    } catch (e) {
      console.error(e);
    }
  }
}
