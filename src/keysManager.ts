import { getSigningKeys } from "./utils/getSigningKeys";
import { redisInstance } from "./db/redisInstance";

type TKeys = {
  [key: string]: string[];
};

interface IKeysManager {
  keysForBlocks: TKeys;
}

export class KeysManager implements IKeysManager {
  keysForBlocks: TKeys = {};

  constructor() {
    this.connectToDB();
  }

  async addKeysForBlock(block: any) {
    const keys = await getSigningKeys({ blockNumber: block.number });
    this.keysForBlocks[block.number.toString()] = keys;
    this.saveKeysToDB({ block, keys });
  }

  private connectToDB() {
    redisInstance.connect();
  }

  private async saveKeysToDB({ block, keys }: { block: any; keys: string[] }) {
    try {
      // @ts-ignore
      BigInt.prototype.toJSON = function () {
        // BigInt can't be serialized to JSON, so we need to convert it to number
        return Number(this);
      };
      await redisInstance.set(block.number, JSON.stringify({ keys, block }));
      console.log("Saved!");
    } catch (e) {
      console.error(e);
    }
  }
}
