import { getContract } from "viem";
import noRegistryABI from "./noRegistryABI";
import { publicClient } from "../publicClient";

export const noRegistryContract = getContract({
  address: "0x595F64Ddc3856a3b5Ff4f4CC1d1fb4B46cFd2bAC",
  abi: noRegistryABI,
  client: publicClient,
});
