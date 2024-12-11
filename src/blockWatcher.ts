import { publicClient } from "./rpc/publicClient";

interface IBlockWatcher {
  blocksStack: any[];
  lastFinalizedBlockNumber: bigint;
  reorgInProgress: boolean;
  startWatching(options?: { callback(block: any): void }): void;
  getCurrentState(): { latestBlocks: any[]; finalizedBlocks: any[] };
}

export class BlockWatcher implements IBlockWatcher {
  blocksStack: any[] = [];
  lastFinalizedBlockNumber = 0n;
  reorgInProgress = false;

  startWatching(options?: { callback(block: any): void }) {
    console.log("Watching blocks...");
    publicClient.watchBlocks({
      onBlock: async (block) => {
        this.handleNewBlock(block);
        if (options && options.callback) {
          options.callback(block);
        }
      },
    });
  }

  getCurrentState() {
    const latestBlocks = this.blocksStack.filter(
      (block) => block.number > this.lastFinalizedBlockNumber
    );

    const finalizedBlocks = this.blocksStack.filter(
      (block) => block.number <= this.lastFinalizedBlockNumber
    );

    return {
      latestBlocks,
      finalizedBlocks,
    };
  }

  private async handleNewBlock(block: any) {
    console.log("New block: ", block.number);
    if (
      !this.blocksStack.length ||
      block.number > this.blocksStack[this.blocksStack.length - 1].number
    ) {
      this.blocksStack.push(block);
      this.sliceFinalizedBlocks();
      this.checkReorg();
    }
  }

  private async sliceFinalizedBlocks() {
    const lastFinalizedBlock = await publicClient.getBlock({
      blockTag: "finalized",
    });
    if (this.lastFinalizedBlockNumber == lastFinalizedBlock.number) return;

    this.lastFinalizedBlockNumber = lastFinalizedBlock.number;
    this.blocksStack = this.blocksStack.filter(
      (block) => block.number >= this.lastFinalizedBlockNumber - 10n
    );
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
      const blockchainBlock = await publicClient.getBlock({
        blockNumber: block.number,
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
