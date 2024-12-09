import { publicClient } from "./rpc/publicClient";

interface IBlockWatcher {
  blocksStack: any[];
  lastFinalizedBlockNumber: bigint;
  startWatching(): void;
  getCurrentState(): { latestBlocks: any[]; finalizedBlocks: any[] };
}

export class BlockWatcher implements IBlockWatcher {
  blocksStack: any[] = [];
  lastFinalizedBlockNumber = 0n;

  startWatching() {
    console.log("Watching blocks...");
    publicClient.watchBlocks({
      onBlock: async (block) => {
        this.handleNewBlock(block);
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

  private async handleNewBlock(block: any) {
    if (
      !this.blocksStack.length ||
      block.number > this.blocksStack[this.blocksStack.length - 1].number
    ) {
      this.blocksStack.push(block);
      this.sliceFinalizedBlocks();
    }
  }
}
