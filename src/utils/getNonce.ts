import { noRegistryContract } from "../contracts/noRegistryContract";

export const getNonce = async (blockNumber: bigint): Promise<number> => {
  return noRegistryContract.read.getNonce() as Promise<number>;
};
