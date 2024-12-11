import { BlockWatcher } from "./blockWatcher";
import { KeysManager } from "./keysManager";

const main = async () => {
  const blockWatcher = new BlockWatcher();
  const keysManager = new KeysManager();

  const onNewBlock = async (block: any) => {
    keysManager.addKeysForBlock(block);
  };

  blockWatcher.startWatching({ callback: onNewBlock });
};

main();
