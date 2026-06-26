import { supabase } from "../supabase.js";
import { getLogger } from "../logger.js";

const logger = getLogger({ scope: "cron:lock" });

const LOCK_NAME = "cron:lock";
const LOCK_TTL_SEC = 120;
const LOCK_ACQUIRE_TIMEOUT_MS = 5_000;
const POLL_INTERVAL_MS = 400;

export type LockResult =
  | { acquired: true; release: () => Promise<void> }
  | { acquired: false; release: null };

export async function acquireCronLock(options: { skipIfLocked?: boolean } = {}): Promise<LockResult> {
  const instanceId = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const start = Date.now();

  while (true) {
    try {
      const { data, error } = await supabase.rpc("acquire_cron_lock", {
        p_name: LOCK_NAME,
        p_instance_id: instanceId,
        p_ttl_seconds: LOCK_TTL_SEC,
      });

      if (error) {
        logger.warn({ err: error.message }, "Lock acquire RPC error");
      } else if (data === true) {
        const id = instanceId;
        const release = async () => {
          try {
            await supabase.rpc("release_cron_lock", {
              p_name: LOCK_NAME,
              p_instance_id: id,
            });
          } catch (err) {
            logger.warn(
              { err: err instanceof Error ? err.message : String(err) },
              "Lock release failed",
            );
          }
        };
        return { acquired: true, release };
      }
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "Lock acquire attempt failed",
      );
    }

    if (Date.now() - start >= LOCK_ACQUIRE_TIMEOUT_MS) {
      if (options.skipIfLocked) {
        logger.warn("Cron lock already held by another instance, skipping");
        return { acquired: false, release: null };
      }
      throw new Error("Failed to acquire cron lock within timeout");
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}
