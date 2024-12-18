import { noRegistryContract } from "../contracts/noRegistryContract";

async function getOperatorKeys(
  operatorId: bigint,
  blockNumber: bigint,
  maxBatchSize: number,
  maxRetryCount = 3
) {
  const totalSigningKeysCount = Number(
    await noRegistryContract.read.getTotalSigningKeyCount([operatorId], {
      blockNumber,
    })
  );

  const batchesCount = Math.ceil(totalSigningKeysCount / maxBatchSize);
  const limit = Math.min(totalSigningKeysCount, maxBatchSize);
  let signingKeys: any[] = [];

  for (const i of [...Array(batchesCount).keys()]) {
    const actualLimit =
      i === batchesCount - 1 ? totalSigningKeysCount % maxBatchSize : limit;

    try {
      const keys = (await noRegistryContract.read.getSigningKeys(
        [operatorId, i * actualLimit, actualLimit],
        { blockNumber }
      )) as any[];

      if (!signingKeys.length) {
        signingKeys = keys;
      } else {
        signingKeys = [
          signingKeys[0].concat(keys[0]),
          signingKeys[1].concat(keys[1]),
          signingKeys[2].concat(keys[2]),
        ];
      }
    } catch (e: any) {
      console.error(`Failed to fetch signing keys for operator ${operatorId}`);
    }
  }

  return { operatorId, keys: signingKeys };
}

export async function getSigningKeys({
  blockNumber,
  maxBatchSize,
}: {
  blockNumber: bigint;
  maxBatchSize: number;
}) {
  const nodeOperatorsCount =
    await noRegistryContract.read.getNodeOperatorsCount();
  const operatorIds = Array.from(
    { length: Number(nodeOperatorsCount) },
    (_, i) => BigInt(i)
  );

  const fetchedKeys = await Promise.all(
    operatorIds.map((operatorId) =>
      getOperatorKeys(operatorId, blockNumber, maxBatchSize)
    )
  );

  return fetchedKeys;
}
