import { normalizeCronLogEntry } from "../utils/log-helpers.js";

// :: In-memory throttle store :: uses Supabase lock
const throttleMap = new Map<string, number>();
const THROTTLE_CLEANUP_INTERVAL = 100;
let throttleOpCounter = 0;

function isThrottled(key: string): boolean {
  const expiresAt = throttleMap.get(key);
  if (expiresAt === undefined) return false;
  if (Date.now() < expiresAt) return true;
  throttleMap.delete(key);
  return false;
}

function setThrottle(key: string, ttlSec: number): void {
  throttleMap.set(key, Date.now() + ttlSec * 1000);
  throttleOpCounter++;
  if (throttleOpCounter >= THROTTLE_CLEANUP_INTERVAL) {
    throttleOpCounter = 0;
    const now = Date.now();
    for (const [k, exp] of throttleMap) {
      if (now >= exp) throttleMap.delete(k);
    }
  }
}

function buildThrottleKey(entry?: Record<string, unknown>): string {
  const normalized = normalizeCronLogEntry(entry);
  return [
    normalized.source || "unknown",
    normalized.code || "no_code",
    normalized.type || "no_type",
  ].join(":");
}

export { isThrottled, setThrottle, buildThrottleKey };
