import { createPublicClient, http } from "viem";
import { holesky } from "viem/chains";
import "dotenv/config";

export const publicClient = createPublicClient({
  chain: holesky,
  transport: http(process.env.NODE_URL),
});
