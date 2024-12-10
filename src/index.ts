import { BlockWatcher } from "./blockWatcher";
import { getSigningKeys } from "./utils/getSigningKeys";

const blockWatcher = new BlockWatcher();
blockWatcher.startWatching();
