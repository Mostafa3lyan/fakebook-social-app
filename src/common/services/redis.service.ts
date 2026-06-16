import { redisClient } from "../../DB/index.js";

export class RedisService {
  baseRevokeTokenKey(userId: string) {
    return `RevokeToken::${userId}`;
  }

  revokeTokenKey({ userId, jti }: { userId: string; jti: string }) {
    return `${this.baseRevokeTokenKey(userId)}::${jti}`;
  }

  otpKey(email: string) {
    return `OTP::User::${email}`;
  }

  otpAttemptsKey(email: string) {
    return `otp::attempts::${email}`;
  }

  otpBlockKey(email: string) {
    return `otp::blocked::${email}`;
  }

  FaKey(user: { _id: any }) {
    return `2fa::request::${user._id}`;
  }

  FaAttemptsKey(user: { _id: any }) {
    return `2fa::attempts::${user._id}`;
  }

  FaBlockKey(user: { _id: any }) {
    return `2fa::blocked::${user._id}`;
  }

  magicLinkRevokeKey(token: string) {
    return `magic::revoked::${token}`;
  }

  async set(key: string, value: any, ttl?: number) {
    try {
      let data = typeof value === "string" ? value : JSON.stringify(value);
      return ttl
        ? await redisClient.set(key, data, { EX: ttl })
        : await redisClient.set(key, data);
    } catch (error) {
      console.log(`Failed to set data in Redis: ${error}`);
    }
  }

  async update(key: string, value: any, ttl?: number) {
    try {
      if (!(await redisClient.exists(key))) return 0;
      return await this.set(key, value, ttl);
    } catch (error) {
      console.log(`Failed to update data in Redis: ${error}`);
    }
  }

  async get(key: string) {
    try {
      const val = await redisClient.get(key);
      if (!val) return null;
      try {
        return JSON.parse(val);
      } catch (error) {
        return val;
      }
    } catch (error) {
      console.log(`Failed to get data from Redis: ${error}`);
    }
  }

  async mGet(keysArray: string[] = []) {
    try {
      if (!keysArray.length) return [];
      return await redisClient.mGet(keysArray);
    } catch (error) {
      console.log(`Failed to multiple get data from Redis: ${error}`);
      return [];
    }
  }

  async ttl(key: string) {
    try {
      return await redisClient.ttl(key);
    } catch (error) {
      console.log(`Failed to get TTL from Redis: ${error}`);
      return 0;
    }
  }

  async exists(key: string) {
    try {
      return await redisClient.exists(key);
    } catch (error) {
      console.log(`Failed to check existence in Redis: ${error}`);
      return 0;
    }
  }

  async expire(key: string, ttlSeconds: number) {
    try {
      return await redisClient.expire(key, ttlSeconds);
    } catch (error) {
      console.log(`Failed to add TTL to key in Redis: ${error}`);
    }
  }

  async incr(key: string) {
    try {
      return await redisClient.incr(key);
    } catch (error) {
      console.log(`Failed to increment key in Redis: ${error}`);
      return 0;
    }
  }

  async del(key: string | string[]) {
    try {
      if (!key || (Array.isArray(key) && !key.length)) return 0;
      return await redisClient.del(key);
    } catch (error) {
      console.log(`Failed to delete key in Redis: ${error}`);
      return 0;
    }
  }

  async keys(prefix: string) {
    try {
      return await redisClient.keys(`${prefix}*`);
    } catch (error) {
      console.log(`Failed to get keys in Redis: ${error}`);
      return [];
    }
  }
}

export const redisService = new RedisService();

export const baseRevokeTokenKey = redisService.baseRevokeTokenKey.bind(redisService);
export const revokeTokenKey = redisService.revokeTokenKey.bind(redisService);
export const otpKey = redisService.otpKey.bind(redisService);
export const otpAttemptsKey = redisService.otpAttemptsKey.bind(redisService);
export const otpBlockKey = redisService.otpBlockKey.bind(redisService);
export const FaKey = redisService.FaKey.bind(redisService);
export const FaAttemptsKey = redisService.FaAttemptsKey.bind(redisService);
export const FaBlockKey = redisService.FaBlockKey.bind(redisService);
export const magicLinkRevokeKey = redisService.magicLinkRevokeKey.bind(redisService);
export const set = redisService.set.bind(redisService);
export const update = redisService.update.bind(redisService);
export const get = redisService.get.bind(redisService);
export const mGet = redisService.mGet.bind(redisService);
export const ttl = redisService.ttl.bind(redisService);
export const exists = redisService.exists.bind(redisService);
export const expire = redisService.expire.bind(redisService);
export const incr = redisService.incr.bind(redisService);
export const del = redisService.del.bind(redisService);
export const keys = redisService.keys.bind(redisService);
