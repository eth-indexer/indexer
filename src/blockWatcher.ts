import { Block } from "viem";
import { publicClient } from "./rpc/publicClient";

const FINALIZED_BLOCKS_TO_KEEP = process.env.FINALIZED_BLOCKS_TO_KEEP || 11;

type TWatchingParams = {
  onChange?(blocks: Block[], isReorg?: boolean): void;
  onRemoveFinalizedBlocks?(
    blocksToRemove: bigint[],
    lastFinalizedBlockNumber: bigint
  ): void;
};

interface IBlockWatcher {
  blocksStack: Block[];
  lastFinalizedBlockNumber: bigint;
  reorgInProgress: boolean;
  startWatching(options?: TWatchingParams): void;
  getCurrentState(): { latestBlocks: Block[]; finalizedBlocks: Block[] };
}

export class BlockWatcher implements IBlockWatcher {
  blocksStack: Block[] = [];
  lastFinalizedBlockNumber = 0n;
  reorgInProgress = false;
  onChange?: (blocks: Block[], isReorg?: boolean) => void;
  onRemoveFinalizedBlocks?: (
    blocksToRemove: bigint[],
    lastFinalizedBlockNumber: bigint
  ) => void;

  constructor(options?: TWatchingParams) {
    this.onChange = options?.onChange;
    this.onRemoveFinalizedBlocks = options?.onRemoveFinalizedBlocks;
  }

  startWatching() {
    if (!this.blocksStack.length) {
      this.coldStart();
    }

    console.log("Watching blocks...");
    publicClient.watchBlocks({
      onBlock: async (block) => {
        await this.handleNewBlock(block);
        this.onChange && this.onChange([block]);
      },
    });
  }

  getCurrentState() {
    const latestBlocks = this.blocksStack.filter(
      (block) => block.number && block.number > this.lastFinalizedBlockNumber
    );

    const finalizedBlocks = this.blocksStack.filter(
      (block) => block.number && block.number <= this.lastFinalizedBlockNumber
    );

    return {
      latestBlocks,
      finalizedBlocks,
    };
  }

  private async coldStart() {
    try {
      const finalizedBlock = await publicClient.getBlock({
        blockTag: "finalized",
      });
      const latestBlock = await publicClient.getBlock({
        blockTag: "latest",
      });

      if (!finalizedBlock.number || !latestBlock.number) return;

      this.lastFinalizedBlockNumber = finalizedBlock.number;
      const startBlockNumber =
        finalizedBlock.number - BigInt(FINALIZED_BLOCKS_TO_KEEP);
      const stopBlockNumber = latestBlock.number - 1n;

      const blocksToAdd = Array.from(
        { length: Number(stopBlockNumber - startBlockNumber) + 1 },
        (_, index) => startBlockNumber + (BigInt(index) as bigint)
      );

      let tempBlocksStack: Block[] = [];
      for (const blockNumber of blocksToAdd) {
        const blockData = await publicClient.getBlock({
          blockNumber,
        });
        tempBlocksStack.push(blockData);
      }
      this.onChange && this.onChange(tempBlocksStack);

      console.log("Cold start finished!");
      this.blocksStack = [...tempBlocksStack, ...this.blocksStack];
    } catch (error) {
      console.error("Error during cold start:", error);
    }
  }

  private async handleNewBlock(block: Block) {
    try {
      console.log("New block: ", block.number);
      const newBlockNumber = block.number || 0n;
      const previousBlockNumber = this.blocksStack.length
        ? this.blocksStack[this.blocksStack.length - 1].number || 0n
        : 0n;
      if (!this.blocksStack.length || newBlockNumber > previousBlockNumber) {
        this.blocksStack.push(block);
        this.removeFinalizedBlocks();
        await this.checkReorg();
      }
    } catch (error) {
      console.error("Error handling new block:", error);
    }
  }

  private async removeFinalizedBlocks() {
    try {
      const lastFinalizedBlock = await publicClient.getBlock({
        blockTag: "finalized",
      });
      if (
        !this.lastFinalizedBlockNumber ||
        this.lastFinalizedBlockNumber === lastFinalizedBlock.number
      )
        return;

      this.lastFinalizedBlockNumber = lastFinalizedBlock.number;
      const blocksToRemove = this.blocksStack
        .filter(
          (block) =>
            block.number &&
            block.number <
              this.lastFinalizedBlockNumber - BigInt(FINALIZED_BLOCKS_TO_KEEP)
        )
        .map((block) => block.number) as bigint[];

      this.blocksStack = this.blocksStack.filter(
        (block) =>
          block.number &&
          block.number >=
            this.lastFinalizedBlockNumber - BigInt(FINALIZED_BLOCKS_TO_KEEP)
      );

      this.onRemoveFinalizedBlocks &&
        this.onRemoveFinalizedBlocks(
          blocksToRemove,
          this.lastFinalizedBlockNumber
        );
    } catch (error) {
      console.error("Error slicing finalized blocks:", error);
    }
  }

  private async checkReorg() {
    try {
      const latestBlock = this.blocksStack[this.blocksStack.length - 1];
      const parentBlock = this.blocksStack[this.blocksStack.length - 2];

      if (
        latestBlock &&
        parentBlock &&
        latestBlock.parentHash !== parentBlock.hash
      ) {
        await this.makeBlocksReorg();
      }
    } catch (error) {
      console.error("Error checking reorg:", error);
    }
  }

  private async makeBlocksReorg() {
    try {
      console.log("Making reorg...");
      this.reorgInProgress = true;
      const revertedBlocks = this.blocksStack
        .slice(0, this.blocksStack.length - 1)
        .reverse();

      const reorgonizedBlocks = [];

      for (const block of revertedBlocks) {
        const blockNumber = block.number;
        if (!blockNumber) continue;
        const blockchainBlock = await publicClient.getBlock({
          blockNumber,
        });
        if (blockchainBlock.hash !== block.hash) {
          const blockIndex = this.blocksStack.findIndex(
            (b) => b.number === block.number
          );
          this.blocksStack[blockIndex] = blockchainBlock;
          reorgonizedBlocks.push(blockchainBlock);
        } else {
          break;
        }
      }
      this.reorgInProgress = false;
      this.onChange && this.onChange(reorgonizedBlocks.reverse(), true);
    } catch (error) {
      console.error("Error making reorg:", error);
      this.reorgInProgress = false;
    }
  }
}
