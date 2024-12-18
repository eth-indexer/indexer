import { BlockWatcher } from "./blockWatcher";
import { KeysManager } from "./keysManager";
import { getSigningKeys } from "./utils/getSigningKeys";
import { RPCHelperInstance } from "./helpers/RPCHelper";
import prisma from "./db/prisma";

const main = async () => {
  const batchSize = await RPCHelperInstance.getMaxBatchSize();
  const keysManager = new KeysManager(batchSize);

  const blockWatcher = new BlockWatcher({
    onChange: keysManager.onChange,
    onRemoveFinalizedBlocks: keysManager.removeFinalizedBlocks,
  });

  blockWatcher.startWatching();
};

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
