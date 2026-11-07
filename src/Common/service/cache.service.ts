import { REDIS_URI } from "./../../config";
import { createClient, RedisClientType } from "redis";

export class CacheService {
  private readonly client: RedisClientType;
  constructor() {
    this.client = createClient({ url: REDIS_URI });
    this.connect();
  }

  async connect() {
    try {
      await this.client.connect();
      console.log(` REDIS CONNECTED `);
    } catch (error) {
      console.log(`Fail on redis connection  `);
    }
  }

  async setCache({
    key,
    value,
    ttl = undefined,
  }: {
    key: string;
    value: any;
    ttl?: number | undefined;
  }) {
    if (typeof value == "object") {
      value = JSON.stringify(value);
    }
    return await this.client.set(key, String(value), { ...(ttl ? { EX: ttl } : {}) });
  }

  async getCache({ key }: { key: string }) {
    let value = await this.client.get(key);

    try {
      return JSON.parse(value as string);
    } catch (error) {
      return value;
    }
  }

  async existCache({ key }: { key: string }) {
    return await this.client.exists(key);
  }

  async updateCache({
    key,
    value,
    ttl = undefined,
  }: {
    key: string;
    value: any;
    ttl?: number;
  }) {
    if (!(await this.existCache({ key }))) {
      return 0;
    }
    return this.setCache({ key, value, ttl });
  }

  async deleteCache({
    key,

  }: {
    key: string| string[];

  }) {
    // redis refuses DEL with no keys
    if (Array.isArray(key) && !key.length) return 0;
    return await this.client.del(key);
  }

  async keysCache({ prefix }: { prefix: string }) {
    return await this.client.keys(`${prefix}*`);
  }

  // atomically replaces an existing key and returns the old value (null if the key did not exist)
  async swapCache({ key, value, ttl }: { key: string; value: string; ttl: number }): Promise<string | null> {
    return (await this.client.sendCommand(["SET", key, value, "XX", "GET", "EX", String(ttl)])) as string | null;
  }

  async ttlCache({ key }: { key: string }) {
    return await this.client.ttl(key);
  }

  async expireCache({ key, ttl }: { key: string; ttl: number }) {
    return await this.client.expire(key, ttl);
  }

  async incrementByCache({
    key,
    value = 1,
  }: {
    key: string;
    value?: number;
  }) {
    return await this.client.incrBy(key, value);
  }
}

export const cacheService = new CacheService();
