import { getSigningKeys } from "./utils/getSigningKeys";

getSigningKeys().then((keys) => {
  console.log(keys.length);
});
