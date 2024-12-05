import { noRegistryContract } from "../contracts/noRegistryContract";

export async function getSigningKeys() {
  const nodeOperatorsCount =
    await noRegistryContract.read.getNodeOperatorsCount();
  const operatorIds = [...Array(Number(nodeOperatorsCount)).keys()];

  const keys: any[] = [];

  for (const operatorId of operatorIds) {
    const limit = await noRegistryContract.read.getTotalSigningKeyCount([
      operatorId,
    ]);
    let signingKeys: any[] = [];
    try {
      signingKeys = (await noRegistryContract.read.getSigningKeys([
        operatorId,
        0,
        limit,
      ])) as any[];
      keys.push(...signingKeys);
    } catch (e) {}
  }

  return keys;
}
