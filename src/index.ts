import { BlockWatcher } from "./blockWatcher";
import { getSigningKeys } from "./utils/getSigningKeys";

getSigningKeys().then((keys) => {
  const blockWatcher = new BlockWatcher();
  blockWatcher.startWatching();
});
