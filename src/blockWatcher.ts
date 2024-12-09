import { publicClient } from "./rpc/publicClient";

interface IBlockWatcher {
  blocksStack: any[];
  startWatching(): void;
}

export class BlockWatcher implements IBlockWatcher {
  blocksStack: any[] = [];
  lastFinalizedBlockNumber: BigInt = BigInt(0);

  async sliceFinalizedBlocks() {
    const lastFinalizedBlock = await publicClient.getBlock({
      blockTag: "finalized",
    });
    if (this.lastFinalizedBlockNumber === lastFinalizedBlock.number) return;

    this.lastFinalizedBlockNumber = lastFinalizedBlock.number;
    const indexOfFinalizedBlock = this.blocksStack.findIndex(
      (block) => block.number === this.lastFinalizedBlockNumber
    );

    if (indexOfFinalizedBlock > -1) {
      console.log("Filter finalized blocks");
      this.blocksStack = this.blocksStack.slice(indexOfFinalizedBlock - 10);
    }
  }

  showCurrentState() {
    const latestBlocks = this.blocksStack
      .filter((block) => block.number > this.lastFinalizedBlockNumber)
      .map((block) => block.number);

    const finalizedBlocks = this.blocksStack
      .filter((block) => block.number <= this.lastFinalizedBlockNumber)
      .map((block) => block.number);

    console.log("Latest blocks: ", latestBlocks);
    console.log("Finalized blocks: ", finalizedBlocks);
  }

  async handleBlock(block: any) {
    console.log("New block: ", block.number);
    if (
      !this.blocksStack.length ||
      block.number > this.blocksStack[this.blocksStack.length - 1].number
    ) {
      this.blocksStack.push(block);
      await this.sliceFinalizedBlocks();
      this.showCurrentState();
    }
  }

  startWatching() {
    console.log("Watching blocks...");
    publicClient.watchBlocks({
      onBlock: async (block) => {
        this.handleBlock(block);
      },
    });
  }
}
