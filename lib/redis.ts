export {};
import { RedisClient } from "./types.js";
import { getLogger } from "./logger.js";

const logger = getLogger({ scope: "redis" });

/**
 * Redis client removed — all operations use in-memory mock.
 * Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to re-enable.
 */
logger.warn("Redis client disabled — using in-memory mock. To re-enable, set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.");

// ── Mock Client ──────────────────────────────────────────
type MockValue = string | number | null | unknown[] | Record<string, unknown>;

const noop = <T extends MockValue>(defaultValue: T) =>
  (..._args: unknown[]) => Promise.resolve(defaultValue) as Promise<T>;

const pipelineNoop = (_operation?: string) =>
  (..._args: unknown[]) => undefined;

function createMockRedisClient(): RedisClient {
  return {
    get: noop(null),
    set: noop("OK" as const),
    del: noop(0),
    hget: noop(null),
    hset: noop(0),
    hsetnx: noop(0),
    hdel: noop(0),
    hgetall: noop({}),
    hmget: noop([]),
    hlen: noop(0),
    httl: noop(-1),
    llen: noop(0),
    lpush: noop(1),
    rpush: noop(1),
    zrange: noop([]),
    zadd: noop(0),
    zrem: noop(0),
    zcard: noop(0),
    zremrangebyscore: noop(0),
    zremrangebyrank: noop(0),
    incr: noop(1),
    expire: noop(1),
    ttl: noop(-1),
    exists: noop(0),
    scan: noop([0, []] as unknown as [string, string[]]),
    mget: noop([]),
    lrange: noop([]),
    lpop: noop(null),
    eval: noop(1),
    ping: () => Promise.resolve("PONG"),
    lrem: noop(0),
    lmove: noop(null),
    ltrim: noop("OK" as const),
    smembers: noop([]),
    sismember: noop(0),
    sadd: noop(1),
    srem: noop(1),
    zincrby: noop(1),
    hscan: noop([0, []] as unknown as [string, string[]]),
    type: noop("string" as const),
    hexpire: noop([1] as unknown as number[]),
    hpexpire: noop([1] as unknown as number[]),
    pipeline: () => {
      const wrap = (op?: string) => (..._a: unknown[]) => undefined;
      let count = 0;
      return {
        get: wrap("get"),
        set: wrap("set"),
        del: wrap("del"),
        hget: wrap("hget"),
        hset: wrap("hset"),
        hsetnx: wrap("hsetnx"),
        hdel: wrap("hdel"),
        hmget: wrap("hmget"),
        hlen: wrap("hlen"),
        zadd: wrap("zadd"),
        zrem: wrap("zrem"),
        expire: wrap("expire"),
        hpexpire: wrap("hpexpire"),
        hexpire: wrap("hexpire"),
        lpush: wrap("lpush"),
        rpush: wrap("rpush"),
        ltrim: wrap("ltrim"),
        zremrangebyscore: wrap("zremrangebyscore"),
        zremrangebyrank: wrap("zremrangebyrank"),
        lrem: wrap("lrem"),
        lmove: wrap("lmove"),
        smembers: wrap("smembers"),
        sismember: wrap("sismember"),
        sadd: wrap("sadd"),
        srem: wrap("srem"),
        scard: wrap("scard"),
        exists: wrap("exists"),
        eval: wrap("eval"),
        incr: wrap("incr"),
        mget: wrap("mget"),
        lrange: wrap("lrange"),
        exec: () => {
          const n = count;
          count = 0;
          return Promise.resolve(new Array(n).fill(null));
        },
        get length() { return count; },
      } as any;
    },
  } as unknown as RedisClient;
}

const mockClient = createMockRedisClient();

/**
 * Redis client singleton — always returns in-memory mock.
 */
export const redis = mockClient;

/**
 * No-op rate limit — always allows.
 */
export async function checkRateLimit(
  _redisClient: RedisClient,
  _key: string,
  _limit: number,
  _windowSec: number,
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  return { allowed: true, remaining: Infinity, reset: Math.floor(Date.now() / 1000) + 60 };
}

/**
 * Executes a list of async tasks in batches.
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
 * No-op distributed lock — executes fn() immediately.
 */
export async function withDistributedLock<T>(
  _redisClient: RedisClient,
  _lockKey: string,
  fn: () => Promise<T>,
  _options: { ttlSec?: number; timeoutMs?: number; label?: string; autoRenew?: boolean } = {},
): Promise<T> {
  return fn();
}

/**
 * No-op warning — Redis is explicitly disabled.
 */
export function getMockRedisWarning(): string {
  return "\n\n⚠️ **Redis Disabled:** All operations use in-memory fallback. Configure `UPSTASH_REDIS_REST_URL` to re-enable.";
}

/**
 * No-op fallback.
 */
export function forceRedisFallback(): void {
  logger.warn("⚠️ Redis already disabled — forceRedisFallback is a no-op.");
}
