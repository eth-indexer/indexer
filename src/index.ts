import { BlockWatcher } from "./blockWatcher";
import { KeysManager } from "./keysManager";

const main = async () => {
  const keysManager = new KeysManager();

  const blockWatcher = new BlockWatcher({
    onNewBlock: keysManager.addKeysForBlock,
    onCutOffFinalizedBlocks: keysManager.cutOffFinalizedBlocks,
  });

  blockWatcher.startWatching();
};

main();
