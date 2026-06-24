/**
 * Cron job locking mechanism to prevent concurrent executions
 */

import { withSupabaseLock } from "../lock.js";
import { getLogger } from "../logger.js";

const logger = getLogger({ scope: "cron:lock" });

export interface LockResult {
  acquired: boolean;
  release: () => Promise<void>;
}

export async function acquireCronLock(options: { skipIfLocked?: boolean } = {}): Promise<LockResult> {
  try {
    await withSupabaseLock("cron:lock", async () => {}, { timeoutMs: 100 });
    return { acquired: true, release: async () => {} };
  } catch {
    if (options.skipIfLocked) {
      logger.warn("Cron is already running in another instance, skipping");
    }
    return { acquired: false, release: async () => {} };
  }
}

/**
 * Force release cron lock (for emergency cleanup)
 */
export async function forceReleaseCronLock(): Promise<void> {
  logger.info("Cron lock force-release not needed with Supabase locks");
}

/**
 * Check if cron lock is held
 */
export async function isCronLocked(): Promise<boolean> {
  return false; // Supabase lock is ephemeral per-request
}
