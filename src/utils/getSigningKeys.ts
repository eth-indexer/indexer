import { noRegistryContract } from "../contracts/noRegistryContract";

async function getOperatorKeys(operatorId: bigint, blockNumber: bigint) {
  const limit = await noRegistryContract.read.getTotalSigningKeyCount(
    [operatorId],
    { blockNumber }
  );
  let signingKeys: any[] = [];
  try {
    signingKeys = (await noRegistryContract.read.getSigningKeys(
      [operatorId, 0, limit],
      { blockNumber }
    )) as any[];
  } catch (e) {}
  return signingKeys;
}

export async function getSigningKeys({ blockNumber }: { blockNumber: bigint }) {
  const nodeOperatorsCount =
    await noRegistryContract.read.getNodeOperatorsCount();
  const operatorIds = Array.from(
    { length: Number(nodeOperatorsCount) },
    (_, i) => BigInt(i)
  );

  const keys: any[] = [];

  const fetchedKeys = await Promise.all(
    operatorIds.map((operatorId) => getOperatorKeys(operatorId, blockNumber))
  );

  keys.push(...fetchedKeys.flat());
  return keys;
}
