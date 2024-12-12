import { Block } from "viem";
import { publicClient } from "./rpc/publicClient";

type TWatchingParams = {
  onNewBlock?(block: Block): void;
  onCutOffFinalizedBlocks?(blocksToRemove: bigint[]): void;
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
  onNewBlock?: (block: Block) => void;
  onCutOffFinalizedBlocks?: (blocksToRemove: bigint[]) => void;

  constructor(options?: TWatchingParams) {
    this.onNewBlock = options?.onNewBlock;
    this.onCutOffFinalizedBlocks = options?.onCutOffFinalizedBlocks;
  }

  startWatching() {
    console.log("Watching blocks...");
    publicClient.watchBlocks({
      onBlock: async (block) => {
        this.handleNewBlock(block);
        this.onNewBlock && this.onNewBlock(block);
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

  private async handleNewBlock(block: Block) {
    console.log("New block: ", block.number);
    const newBlockNumber = block.number || 0;
    const previousBlockNumber = this.blocksStack.length
      ? this.blocksStack[this.blocksStack.length - 1].number || 0
      : 0;
    if (!this.blocksStack.length || newBlockNumber > previousBlockNumber) {
      this.blocksStack.push(block);
      this.sliceFinalizedBlocks();
      this.checkReorg();
    }
  }

  private async sliceFinalizedBlocks() {
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
          block.number && block.number <= this.lastFinalizedBlockNumber - 10n
      )
      .map((block) => block.number) as bigint[];

    this.blocksStack = this.blocksStack.filter(
      (block) =>
        block.number && block.number >= this.lastFinalizedBlockNumber - 10n
    );

    this.onCutOffFinalizedBlocks &&
      this.onCutOffFinalizedBlocks(blocksToRemove);
  }

  private checkReorg() {
    const latestBlock = this.blocksStack[this.blocksStack.length - 1];
    const parentBlock = this.blocksStack[this.blocksStack.length - 2];

    if (
      latestBlock &&
      parentBlock &&
      latestBlock.parentHash !== parentBlock.hash
    ) {
      this.makeBlocksReorg();
    }
  }

  private async makeBlocksReorg() {
    console.log("Making reorg...");
    this.reorgInProgress = true;
    const revertedBlocks = this.blocksStack
      .slice(0, this.blocksStack.length - 1)
      .reverse();

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
      } else {
        break;
      }
    }
    this.reorgInProgress = false;
  }
}
