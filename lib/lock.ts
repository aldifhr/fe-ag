/**
 * Supabase-based distributed locking
 * Replaces withDistributedLock() from lib/redis.ts
 *
 * Uses cron_locks table + acquire_cron_lock / release_cron_lock RPCs
 * from migration 00006_redis_removal.sql
 */

import { supabase } from "./supabase.js";
import { getLogger } from "./logger.js";

const logger = getLogger({ scope: "lock" });

const DEFAULT_TTL_SEC = 60;
const DEFAULT_TIMEOUT_MS = 10000;
const POLL_INTERVAL_MS = 400;

/**
 * Execute a function within a Supabase-backed distributed lock.
 * Guarantees mutual exclusion across multiple instances via PostgreSQL advisory lock semantics.
 *
 * @param name      - Lock name (unique identifier)
 * @param fn        - Async function to execute within the lock
 * @param options   - Lock options
 */
export async function withSupabaseLock<T>(
  name: string,
  fn: () => Promise<T>,
  options: {
    ttlSec?: number;
    timeoutMs?: number;
    label?: string;
  } = {},
): Promise<T> {
  const {
    ttlSec = DEFAULT_TTL_SEC,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    label = name,
  } = options;

  const instanceId = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const start = Date.now();
  let acquired = false;

  // Spin until lock acquired or timeout
  while (true) {
    try {
      const { data, error } = await supabase.rpc("acquire_cron_lock", {
        p_name: name,
        p_instance_id: instanceId,
        p_ttl_seconds: ttlSec,
      });

      if (error) {
        logger.warn({ err: error.message, label }, "Lock acquire RPC error");
      } else if (data === true) {
        acquired = true;
        break;
      }
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err), label },
        "Lock acquire attempt failed",
      );
    }

    if (Date.now() - start >= timeoutMs) break;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  if (!acquired) {
    throw new Error(
      `Failed to acquire lock "${label}" within ${timeoutMs}ms. Please try again later.`,
    );
  }

  try {
    return await fn();
  } finally {
    try {
      await supabase.rpc("release_cron_lock", {
        p_name: name,
        p_instance_id: instanceId,
      });
    } catch (releaseErr) {
      logger.warn(
        {
          err:
            releaseErr instanceof Error
              ? releaseErr.message
              : String(releaseErr),
          label,
        },
        "Lock release failed",
      );
    }
  }
}
