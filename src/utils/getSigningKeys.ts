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
  const signingKeys: any[] = [];
  let retryCount = 0;

  while (retryCount < maxRetryCount) {
    try {
      for (let i = 0; i < batchesCount; i++) {
        const actualLimit =
          i === batchesCount - 1 ? totalSigningKeysCount % maxBatchSize : limit;
        const keys = (await noRegistryContract.read.getSigningKeys(
          [operatorId, i * actualLimit, actualLimit],
          { blockNumber }
        )) as any[];
        signingKeys.push(...keys);
      }
      break;
    } catch (e: any) {
      console.error(
        `Failed to fetch signing keys for operator ${operatorId}, attempt ${
          retryCount + 1
        }/${maxRetryCount}`
      );
      retryCount++;
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
