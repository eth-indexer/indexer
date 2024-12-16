import { Block } from "viem";
import { publicClient } from "./rpc/publicClient";

const FINALIZED_BLOCKS_TO_KEEP = process.env.FINALIZED_BLOCKS_TO_KEEP || 11;

type TWatchingParams = {
  onChange?(blocks: Block[], isReorg?: boolean): void;
  onCutOffFinalizedBlocks?(blocksToRemove: BigInt[]): void;
};

interface IBlockWatcher {
  blocksStack: Block[];
  lastFinalizedBlockNumber: BigInt;
  reorgInProgress: boolean;
  startWatching(options?: TWatchingParams): void;
  getCurrentState(): { latestBlocks: Block[]; finalizedBlocks: Block[] };
}

export class BlockWatcher implements IBlockWatcher {
  blocksStack: Block[] = [];
  lastFinalizedBlockNumber = 0n;
  reorgInProgress = false;
  onChange?: (blocks: Block[], isReorg?: boolean) => void;
  onCutOffFinalizedBlocks?: (blocksToRemove: BigInt[]) => void;

  constructor(options?: TWatchingParams) {
    this.onChange = options?.onChange;
    this.onCutOffFinalizedBlocks = options?.onCutOffFinalizedBlocks;
  }

  startWatching() {
    if (!this.blocksStack.length) {
      this.coldStart();
    }

    console.log("Watching blocks...");
    publicClient.watchBlocks({
      onBlock: async (block) => {
        this.handleNewBlock(block);
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
    const stopBlockNumber = latestBlock.number - BigInt(1);

    const blocksToAdd = Array.from(
      { length: Number(stopBlockNumber - startBlockNumber) + 1 },
      (_, index) => startBlockNumber + BigInt(index)
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
  }

  private async handleNewBlock(block: Block) {
    console.log("New block: ", block.number);
    const newBlockNumber = block.number || 0;
    const previousBlockNumber = this.blocksStack.length
      ? this.blocksStack[this.blocksStack.length - 1].number || 0
      : 0;
    if (!this.blocksStack.length || newBlockNumber > previousBlockNumber) {
      this.blocksStack.push(block);
      // this.sliceFinalizedBlocks();
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
          block.number &&
          block.number <
            this.lastFinalizedBlockNumber - BigInt(FINALIZED_BLOCKS_TO_KEEP)
      )
      .map((block) => block.number) as BigInt[];

    this.blocksStack = this.blocksStack.filter(
      (block) =>
        block.number &&
        block.number >=
          this.lastFinalizedBlockNumber - BigInt(FINALIZED_BLOCKS_TO_KEEP)
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
    // TODO rewrite this to get reorged blocks and pass it to the onChange callback

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
