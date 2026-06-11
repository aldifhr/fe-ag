export {}; // Ensure file remains a module if other imports are removed later
import { Redis } from "@upstash/redis";
import { getLogger } from "./logger.js";
import { env } from "./config/env.js";
import {
  RedisClient,
  RedisValue,
  RedisPipeline,
} from "./types.js";

const logger = getLogger({ scope: "redis" });

/**
 * Lua script for re-entrant lock acquisition
 */
const ACQUIRE_LOCK_SCRIPT = `
  local val = redis.call("get", KEYS[1])
  if not val then
    redis.call("set", KEYS[1], ARGV[1], "EX", tonumber(ARGV[2]))
    return 1
  elseif val == ARGV[1] then
    redis.call("expire", KEYS[1], tonumber(ARGV[2]))
    return 1
  else
    return 0
  end
`;

/**
 * Lua script for atomic lock release (compare-and-delete)
 * Prevents race condition where lock expires between GET and DEL
 */
const RELEASE_LOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

/**
 * Lua script for atomic lock renewal (heartbeat)
 * Prevents extending a lock that has already been stolen or expired.
 */
const RENEW_LOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("expire", KEYS[1], tonumber(ARGV[2]))
  else
    return 0
  end
`;

const ATOMIC_INCR_EXPIRE_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if tonumber(current) == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
end
return current
`;

/**
 * Create Redis client with graceful error handling
 */
function createRedisClient(): RedisClient {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    logger.error(
      "Redis configuration missing: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set",
    );
    if (process.env.NODE_ENV === "production") {
      throw new Error("Redis configuration required in production — check UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN");
    }
    return createMockRedisClient();
  }

  try {
    return new Redis({
      url,
      token,
      enableAutoPipelining: true,
    }) as unknown as RedisClient;
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, "Failed to create Redis client, using mock");
    if (process.env.NODE_ENV === "production") {
      throw new Error("Failed to connect to Redis — starting in production without Redis will cause data loss");
    }
    return createMockRedisClient();
  }
}

/**
 * Mock Redis client for graceful degradation when Redis is unavailable
 */
function createMockRedisClient(): RedisClient {
  if (process.env.NODE_ENV === "production") {
    logger.error("🚨 Mock Redis activated in PRODUCTION — all rate limiting and caching disabled. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.");
  } else {
    logger.warn("Mock Redis active (non-production mode) — data will not be persisted.");
  }

  type MockValue = string | number | null | unknown[] | Record<string, unknown>;
  
  const mockOperation = <T extends MockValue>(operation: string, defaultValue: T) =>
    (...args: unknown[]) => {
      logger.warn(
        { operation, args: args.slice(0, 2) },
        `Mock Redis: ${operation} called`,
      );
      return Promise.resolve(defaultValue) as Promise<T>;
    };

  const pipelineOperation = (operation: string) =>
    (...args: unknown[]) => {
      logger.warn(
        { operation: `pipeline.${operation}`, args: args.slice(0, 2) },
        `Mock Redis: pipeline.${operation} called`,
      );
      return undefined;
    };

  return {
    get: mockOperation("get", null),
    set: mockOperation("set", "OK"),
    del: mockOperation("del", 0),
    hget: mockOperation("hget", null),
    hset: mockOperation("hset", 0),
    hsetnx: mockOperation("hsetnx", 0),
    hdel: mockOperation("hdel", 0),
    hgetall: mockOperation("hgetall", {}),
    hmget: mockOperation("hmget", []),
    hlen: mockOperation("hlen", 0),
    llen: mockOperation("llen", 0),
    zrange: mockOperation("zrange", []),
    zadd: mockOperation("zadd", 0),
    zrem: mockOperation("zrem", 0),
    zcard: mockOperation("zcard", 0),
    incr: mockOperation("incr", 1),
    expire: mockOperation("expire", 1),
    ttl: mockOperation("ttl", -1),
    exists: mockOperation("exists", 0),
    scan: mockOperation("scan", [0, []]),
    mget: mockOperation("mget", []),
    lrange: mockOperation("lrange", []),
    rpush: mockOperation("rpush", 1),
    lpop: mockOperation("lpop", null),
    eval: mockOperation("eval", 1),
    ping: () => Promise.resolve("PONG"),
    lpush: mockOperation("lpush", 1),
    ltrim: mockOperation("ltrim", "OK"),
    smembers: mockOperation("smembers", []),
    sismember: mockOperation("sismember", 0),
    sadd: mockOperation("sadd", 1),
    srem: mockOperation("srem", 1),
    zincrby: mockOperation("zincrby", 1),
    hscan: mockOperation("hscan", [0, []]),
    type: mockOperation("type", "string"),
    hexpire: mockOperation("hexpire", [1]),
    hpexpire: mockOperation("hpexpire", [1]),
    pipeline: () => {
      let count = 0;
      const wrap = <T extends (...args: unknown[]) => unknown>(fn: T) => (...args: Parameters<T>) => {
        count++;
        return fn(...args);
      };
      return {
        get: wrap(pipelineOperation("get")),
        set: wrap(pipelineOperation("set")),
        del: wrap(pipelineOperation("del")),
        hget: wrap(pipelineOperation("hget")),
        hset: wrap(pipelineOperation("hset")),
        hsetnx: wrap(pipelineOperation("hsetnx")),
        hdel: wrap(pipelineOperation("hdel")),
        hmget: wrap(pipelineOperation("hmget")),
        hlen: wrap(pipelineOperation("hlen")),
        zadd: wrap(pipelineOperation("zadd")),
        zrem: wrap(pipelineOperation("zrem")),
        expire: wrap(pipelineOperation("expire")),
        hpexpire: wrap(pipelineOperation("hpexpire")),
        hexpire: wrap(pipelineOperation("hexpire")),
        lpush: wrap(pipelineOperation("lpush")),
        rpush: wrap(pipelineOperation("rpush")),
        ltrim: wrap(pipelineOperation("ltrim")),
        zremrangebyscore: wrap(pipelineOperation("zremrangebyscore")),
        zremrangebyrank: wrap(pipelineOperation("zremrangebyrank")),
        lrem: wrap(pipelineOperation("lrem")),
        lmove: wrap(pipelineOperation("lmove")),
        smembers: wrap(pipelineOperation("smembers")),
        sismember: wrap(pipelineOperation("sismember")),
        sadd: wrap(pipelineOperation("sadd")),
        srem: wrap(pipelineOperation("srem")),
        scard: wrap(pipelineOperation("scard")),
        exists: wrap(pipelineOperation("exists")),
        eval: wrap(pipelineOperation("eval")),
        exec: () => {
          const finalCount = count;
          count = 0;
          return Promise.resolve(new Array(finalCount).fill(null));
        },
        get length() {
          return count;
        },
      };
    },
  } as unknown as RedisClient;
}

let activeRedisClient: RedisClient | null = null;

function getRedisClient(): RedisClient {
  if (!activeRedisClient) {
    activeRedisClient = createRedisClient();
  }
  return activeRedisClient;
}

export const redis = new Proxy({} as RedisClient, {
  get(target, prop, receiver) {
    const client = getRedisClient();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
  set(target, prop, value, receiver) {
    const client = getRedisClient();
    return Reflect.set(client, prop, value, receiver);
  }
});

/**
 * Simple rate limiting using Redis INCR and EXPIRE.
 * Returns { allowed: boolean, remaining: number, reset: number }
 */
export async function checkRateLimit(
  redisClient: RedisClient,
  key: string,
  limit: number,
  windowSec: number,
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  try {
    const current = Number(
      await redisClient.eval(ATOMIC_INCR_EXPIRE_SCRIPT, [key], [windowSec])
    );
    const ttl = await redisClient.ttl(key);
    const reset = Math.floor(Date.now() / 1000) + (ttl > 0 ? ttl : windowSec);

    return {
      allowed: current < limit,
      remaining: Math.max(0, limit - current),
      reset,
    };
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err);
    logger.error({ err: errMessage, key }, "Rate limit check failed — rejecting by default (fail-closed)");
    return { allowed: false, remaining: 0, reset: Math.floor(Date.now() / 1000) + windowSec };
  }
}

/**
 * @deprecated HPEXPIRE is not supported by Upstash. TTL hash field
 * enforcement is handled via fireAndForgetCleanup() which reads the `e` field
 * from each JSON entry and removes expired ones.
 */



/**
 * Executes a list of asynchronous tasks in batches
 */
export async function flushWriteTasks(
  tasks: (() => Promise<unknown>)[],
  batchSize = 50,
): Promise<void> {
  if (!tasks?.length) return;
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    await Promise.all(batch.map((task) => task()));
  }
}

/**
 * Executes a function within a distributed lock.
 * Ensures the lock is released safely using Lua.
 */
export async function withDistributedLock<T>(
  redisClient: RedisClient,
  lockKey: string,
  fn: () => Promise<T>,
  options: { ttlSec?: number; timeoutMs?: number; label?: string; autoRenew?: boolean } = {},
): Promise<T> {
  const { ttlSec = 60, timeoutMs = 10000, label = "lock", autoRenew = false } = options;
  const clientId = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const start = Date.now();

  let acquired = false;
  const maxWait = timeoutMs;
  
  while (true) {
    const res = await redisClient.eval(ACQUIRE_LOCK_SCRIPT, [lockKey], [clientId, String(ttlSec)]);
    if (Number(res) === 1 || res === "OK") {
      acquired = true;
      break;
    }
    
    // If we've already waited long enough, stop
    if (Date.now() - start >= maxWait) break;
    
    // Otherwise, wait a bit before trying again
    await new Promise(r => setTimeout(r, 400));
  }

  if (!acquired) {
    throw new Error(`Failed to acquire lock ${label} (Timeout). Please try again later.`);
  }

  let renewInterval: NodeJS.Timeout | null = null;
  if (autoRenew) {
    const intervalMs = Math.max(5, Math.floor(ttlSec / 3)) * 1000;
    renewInterval = setInterval(async () => {
      try {
        const renewed = await redisClient.eval(RENEW_LOCK_SCRIPT, [lockKey], [clientId, String(ttlSec)]);
        if (Number(renewed) === 1) {
          logger.debug({ lockKey, label, ttlSec }, "Lock extended successfully (heartbeat)");
        } else {
          logger.warn({ lockKey, label }, "Lock heartbeat failed: Lock owned by someone else or expired");
        }
      } catch (err) {
        logger.error({ err: err instanceof Error ? err.message : String(err), lockKey, label }, "Lock heartbeat renewal error");
      }
    }, intervalMs);
    // Unref the timer so it doesn't prevent Node process from exiting if needed
    if (renewInterval && typeof renewInterval.unref === "function") {
      renewInterval.unref();
    }
  }

  try {
    return await fn();
  } finally {
    if (renewInterval) {
      clearInterval(renewInterval);
    }
    try {
      // Use Lua script for atomic compare-and-delete to prevent race condition
      await redisClient.eval(RELEASE_LOCK_SCRIPT, [lockKey], [clientId]);
    } catch (releaseErr) {
      logger.warn({ err: (releaseErr as Error).message, lockKey }, "Lock release failed");
    }
  }
}

/**
 * Warn user when Upstash Redis config is missing or using a mock
 */
export function getMockRedisWarning(): string {
  const url = env.UPSTASH_REDIS_REST_URL;
  if (!url || url.includes("mock-redis.com") || url === "") {
    return "\n\n⚠️ **Mock Redis Active:** Data will not be persisted. Configure `UPSTASH_REDIS_REST_URL` in Environment Variables.";
  }
  return "";
}

