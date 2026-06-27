/**
 * Dashboard login throttling to prevent brute force
 */

import { getLogger } from "../../shared/logger.js";
import { getClientAddress } from "./ip.js";
import {
  getDashboardLoginWindowSeconds,
  getDashboardLoginMaxAttempts,
} from "./config.js";
import type { RequestLike } from "./http.js";

const logger = getLogger({ scope: "auth:throttle" });

/** In-memory store for login attempt tracking â€” keyed by throttle key, value is { count, resetAt } */
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export interface ThrottleSnapshot {
  count: number;
  limited: boolean;
  retryAfterSec: number;
}

/**
 * Build throttle snapshot from stored values
 */
function buildThrottleSnapshot(
  count: number | null | undefined,
  retryAfterSec: number | null | undefined,
): ThrottleSnapshot {
  const safeCount = Number(count || 0);
  const safeRetryAfter = Number(retryAfterSec || 0);

  if (safeCount <= 0 || safeRetryAfter <= 0) {
    return {
      count: 0,
      limited: false,
      retryAfterSec: 0,
    };
  }

  return {
    count: safeCount,
    limited: safeCount >= getDashboardLoginMaxAttempts(),
    retryAfterSec: Math.max(1, Math.ceil(safeRetryAfter)),
  };
}

/**
 * Get storage key for login throttle
 */
function getDashboardLoginThrottleKey(req: RequestLike): string {
  return `auth:dashboard:login:${getClientAddress(req) || "unknown"}:count`;
}

/**
 * Read current throttle status
 */
export async function readDashboardLoginThrottle(
  req: RequestLike,
): Promise<ThrottleSnapshot> {
  const key = getDashboardLoginThrottleKey(req);
  const entry = loginAttempts.get(key);

  if (!entry) {
    return buildThrottleSnapshot(null, 0);
  }

  const now = Date.now();
  if (now >= entry.resetAt) {
    // Window expired â€” treat as no entry
    loginAttempts.delete(key);
    return buildThrottleSnapshot(null, 0);
  }

  const remainingSec = Math.ceil((entry.resetAt - now) / 1000);
  return buildThrottleSnapshot(entry.count, remainingSec);
}

/**
 * Register a login failure (increment counter)
 */
export async function registerDashboardLoginFailure(
  req: RequestLike,
): Promise<ThrottleSnapshot> {
  const windowSec = getDashboardLoginWindowSeconds();
  const key = getDashboardLoginThrottleKey(req);
  const now = Date.now();

  let entry = loginAttempts.get(key);

  if (!entry || now >= entry.resetAt) {
    // First failure or expired window â€” start fresh
    entry = { count: 0, resetAt: now + windowSec * 1000 };
    loginAttempts.set(key, entry);
  }

  entry.count += 1;

  return buildThrottleSnapshot(entry.count, windowSec);
}

/**
 * Clear login throttle (after successful login)
 */
export async function clearDashboardLoginThrottle(
  req: RequestLike,
): Promise<void> {
  loginAttempts.delete(getDashboardLoginThrottleKey(req));
}
