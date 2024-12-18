import { getContract } from "viem";
import noRegistryABI from "./noRegistryABI";
import { publicClient } from "../rpc/publicClient";

const CONTRACT_ADDRESS =
  process.env.CONTRACT_ADDRESS || "0x595F64Ddc3856a3b5Ff4f4CC1d1fb4B46cFd2bAC";

export const noRegistryContract = getContract({
  address: CONTRACT_ADDRESS as `0x${string}`,
  abi: noRegistryABI,
  client: publicClient,
});
