import { BlockWatcher } from "./blockWatcher";
import { KeysManager } from "./keysManager";
import { getSigningKeys } from "./utils/getSigningKeys";
import { RPCHelperInstance } from "./helpers/RPCHelper";

const main = async () => {
  const batchSize = await RPCHelperInstance.getOptimalBatchSize();
  const keysManager = new KeysManager(batchSize);

  const blockWatcher = new BlockWatcher({
    onNewBlock: keysManager.addKeysForBlock,
    onCutOffFinalizedBlocks: keysManager.cutOffFinalizedBlocks,
  });

  blockWatcher.startWatching();
};

main();
