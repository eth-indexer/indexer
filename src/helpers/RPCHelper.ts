import { noRegistryContract } from "../contracts/noRegistryContract";

class RPCHelper {
  private static _instance: RPCHelper;
  public maxBatchSize: number = 0;

  private constructor() {
    this.findMaxBatchSize = this.findMaxBatchSize.bind(this);
  }

  public static get Instance() {
    return this._instance || (this._instance = new this());
  }

  public async getMaxBatchSize() {
    if (!this.maxBatchSize) {
      this.maxBatchSize = await this.findMaxBatchSize({
        low: 1,
        high: 1500,
      });
    }

    return this.maxBatchSize;
  }

  private async checkSignInKeysRequestLimit(
    operatorId: bigint,
    limit: number
  ): Promise<boolean> {
    try {
      await noRegistryContract.read.getSigningKeys([operatorId, 0, limit]);
      return true;
    } catch (e) {
      return false;
    }
  }

  private async findMaxBatchSize({
    low = 1,
    high = 1200,
  }: {
    low: number;
    high: number;
  }): Promise<number> {
    const nodeOperatorsCount =
      await noRegistryContract.read.getNodeOperatorsCount();
    const operatorIds = Array.from(
      { length: Number(nodeOperatorsCount) },
      (_, i) => BigInt(i)
    );

    let result = 0;
    console.log("Finding optimal batch size");
    for (const operatorId of operatorIds) {
      let currentHigh = high;
      const totalKeysCount =
        (await noRegistryContract.read.getTotalSigningKeyCount([
          operatorId,
        ])) as number;

      while (low <= currentHigh) {
        const mid = Math.floor((low + currentHigh) / 2);
        const success = await this.checkSignInKeysRequestLimit(operatorId, mid);

        if (success) {
          low = mid + 1;
        } else {
          currentHigh = mid - 1;
        }
      }
      result = Math.max(result, currentHigh);
      if (result < totalKeysCount) {
        break;
      }
    }

    return result;
  }
}

export const RPCHelperInstance = RPCHelper.Instance;
