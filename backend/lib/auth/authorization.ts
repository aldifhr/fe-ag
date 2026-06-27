/**
 * Authorization checks for different endpoints
 */

import { getLogger } from "../../shared/logger.js";
import { getHeader } from "./http.js";
import { getCronSecret, getDashboardPassword } from "./config.js";
import { isDashboardSessionAuthorized, getSessionCookieHeader, getClearSessionCookieHeader } from "./session.js";
import { env } from "../../shared/config/env.js";
import type { RequestLike } from "./http.js";

const logger = getLogger({ scope: "auth:authorization" });

function constantTimeCompare(a: string, b: string): boolean {
  const lenA = a.length;
  const lenB = b.length;
  const maxLen = Math.max(lenA, lenB);
  // Pad both strings so timing doesn't leak the shorter length
  const paddedA = a.padEnd(maxLen, "\0");
  const paddedB = b.padEnd(maxLen, "\0");
  let result = lenA ^ lenB;
  for (let i = 0; i < maxLen; i++) {
    result |= paddedA.charCodeAt(i) ^ paddedB.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Check if monitor endpoint is authorized
 * Accepts: Bearer token (CRON_SECRET or DASHBOARD_PASSWORD) or valid session
 */
export async function isMonitorAuthorized(req: RequestLike): Promise<boolean> {
  const provided = getHeader(req, "authorization");
  logger.debug({ authHeader: provided?.substring(0, 20) }, "isMonitorAuthorized check");

  // Accept Bearer token - CRON_SECRET or DASHBOARD_PASSWORD
  if (provided?.startsWith("Bearer ")) {
    const token = provided.substring(7);

    const cronSecret = getCronSecret();
    if (cronSecret && constantTimeCompare(token, cronSecret)) return true;

    const dashboardPassword = getDashboardPassword();
    if (dashboardPassword && constantTimeCompare(token, dashboardPassword)) return true;
  }

  // Fall back to session check
  return await isDashboardSessionAuthorized(req);
}

/**
 * Check if cron endpoint is authorized
 * Accepts: Bearer CRON_SECRET or (if ALLOW_DASHBOARD_CRON) valid session
 */
export async function isCronAuthorized(req: RequestLike): Promise<boolean> {
  const secret = getCronSecret();
  const provided = getHeader(req, "authorization");

  if (secret && provided?.startsWith("Bearer ")) {
    const token = provided.substring(7);
    if (constantTimeCompare(token, secret)) return true;
  }

  return (
    env.ALLOW_DASHBOARD_CRON &&
    await isDashboardSessionAuthorized(req)
  );
}

// Re-export cookie helpers for convenience
export { getSessionCookieHeader, getClearSessionCookieHeader };
