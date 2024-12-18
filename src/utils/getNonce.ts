import { noRegistryContract } from "../contracts/noRegistryContract";

export const getNonce = async (blockNumber: bigint): Promise<bigint> => {
  return noRegistryContract.read.getNonce() as Promise<bigint>;
};

export const getNonces = async (
  blockNumbers: bigint[]
): Promise<{ blockNumber: bigint; nonce: bigint }[]> => {
  return Promise.all(
    blockNumbers.map(async (blockNumber) => {
      return { blockNumber, nonce: await getNonce(blockNumber) };
    })
  );
};
