import { noRegistryContract } from "../contracts/noRegistryContract";

export const getNonce = async (blockNumber: BigInt): Promise<BigInt> => {
  return noRegistryContract.read.getNonce() as Promise<BigInt>;
};

export const getNonces = async (
  blockNumbers: BigInt[]
): Promise<{ blockNumber: BigInt; nonce: BigInt }[]> => {
  return Promise.all(
    blockNumbers.map(async (blockNumber) => {
      return { blockNumber, nonce: await getNonce(blockNumber) };
    })
  );
};
