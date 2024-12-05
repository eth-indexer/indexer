import { createPublicClient, http } from "viem";
import { holesky } from "viem/chains";
import "dotenv/config";

console.log("NODE_URL ", process.env.NODE_URL);

export const publicClient = createPublicClient({
  chain: holesky,
  transport: http(process.env.NODE_URL),
});
