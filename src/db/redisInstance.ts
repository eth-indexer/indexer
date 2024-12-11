import { createClient } from "redis";
export const redisInstance = createClient();
redisInstance.connect();
