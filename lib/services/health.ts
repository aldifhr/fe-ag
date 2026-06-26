import { supabase } from "../supabase.js";
import { mangaProviderRegistry } from "../providers/registry.js";
import { initializeAllProviders } from "../boot.js";
import { 
  SourceHealth, 
  BuildNextSourceHealthMapOptions 
} from "../types.js";

import { getLogger } from "../logger.js";

const logger = getLogger({ scope: "health" });

// --- Source Health Management (Restored) ---

/**
 * Build a default healthy SourceHealth baseline for a given source key.
 */
export function defaultSourceHealth(key: string): SourceHealth {
  return {
    source: key,
    status: "healthy",
    consecutiveFailures: 0,
    disabledUntil: null,
    lastError: null,
    lastSuccessAt: null,
    lastCheckedAt: null,
    responseTime: null,
    failuresToday: 0,
    successesToday: 0,
  };
}

/**
 * Sanitize a raw (possibly invalid) health object into a valid SourceHealth.
 */
export function sanitizeSourceHealth(key: string, raw: unknown): SourceHealth {
  const baseline = defaultSourceHealth(key);
  if (!raw || typeof raw !== "object") return baseline;
  const r = raw as Record<string, unknown>;
  const validStatuses: SourceHealth["status"][] = ["healthy", "degraded"];
  const status = validStatuses.includes(r.status as SourceHealth["status"])
    ? (r.status as SourceHealth["status"])
    : baseline.status;
  const consecutiveFailures = Number.isFinite(Number(r.consecutiveFailures))
    ? Number(r.consecutiveFailures)
    : 0;
  return {
    ...baseline,
    status,
    consecutiveFailures,
    disabledUntil: typeof r.disabledUntil === "string" ? r.disabledUntil : null,
    lastError: typeof r.lastError === "string" ? r.lastError : null,
    lastSuccessAt: typeof r.lastSuccessAt === "string" ? r.lastSuccessAt : null,
    lastCheckedAt: typeof r.lastCheckedAt === "string" ? r.lastCheckedAt : null,
    responseTime: typeof r.responseTime === "number" ? r.responseTime : null,
    failuresToday: typeof r.failuresToday === "number" ? r.failuresToday : 0,
    successesToday: typeof r.successesToday === "number" ? r.successesToday : 0,
  };
}

/**
 * Check whether a source is currently in cooldown based on its disabledUntil field.
 */
export function isSourceInCooldown(health: SourceHealth, nowMs: number = Date.now()): boolean {
  if (!health?.disabledUntil) return false;
  return new Date(health.disabledUntil).getTime() > nowMs;
}

/**
 * Apply a single scrape outcome to a SourceHealth entry and return the updated entry.
 */
export function applySourceOutcome(
  current: SourceHealth,
  outcome: { status: string; error?: string },
  nowIso: string,
  options?: { failureThreshold?: number; cooldownSeconds?: number },
): SourceHealth {
  const failureThreshold = options?.failureThreshold ?? 3;
  const cooldownSeconds = options?.cooldownSeconds ?? 3600;
  const nextHealth: SourceHealth = { ...current };

  // Reset counters if new day
  const lastDate = current.lastCheckedAt ? new Date(current.lastCheckedAt).getUTCDate() : -1;
  const nowDate = new Date().getUTCDate();
  if (lastDate !== -1 && lastDate !== nowDate) {
    nextHealth.failuresToday = 0;
    nextHealth.successesToday = 0;
  }

  if (outcome.status === "error") {
    nextHealth.consecutiveFailures = (current.consecutiveFailures || 0) + 1;
    nextHealth.failuresToday = (nextHealth.failuresToday || 0) + 1;
    nextHealth.lastError = outcome.error || "Unknown error";
    if (nextHealth.consecutiveFailures >= failureThreshold) {
      nextHealth.status = "degraded";
      let baseCooldownSec = cooldownSeconds;
      const errUpper = (outcome.error || "").toUpperCase();
      if (errUpper.includes("429") || errUpper.includes("RATE LIMIT")) {
        baseCooldownSec = 14400; // 4 hours for rate limit
      } else if (errUpper.includes("TIMEOUT") || errUpper.includes("ETIMEDOUT")) {
        baseCooldownSec = 900; // 15 minutes for timeout
      }
      
          // Calculate backoff factor (max 2^5 = 32x)
      const extraFailures = Math.max(0, nextHealth.consecutiveFailures - failureThreshold);
      const backoffFactor = Math.pow(2, Math.min(extraFailures, 5));
      
      // Add +/- 10% random jitter to prevent thundering herd
      const jitter = 0.9 + Math.random() * 0.2;
      const actualCooldownSec = Math.round(baseCooldownSec * backoffFactor * jitter);
      
      nextHealth.disabledUntil = new Date(Date.now() + actualCooldownSec * 1000).toISOString();
      logger.info(
        { source: current.source, consecutiveFailures: nextHealth.consecutiveFailures, baseCooldownSec, actualCooldownSec },
        "Exponential backoff cooldown applied to health monitoring outcome"
      );
    }
  } else if (
    outcome.status === "ok" ||
    outcome.status === "healthy" ||
    outcome.status === "success"
  ) {
    nextHealth.consecutiveFailures = 0;
    nextHealth.status = "healthy";
    nextHealth.lastError = null;
    nextHealth.lastSuccessAt = nowIso;
    nextHealth.successesToday = (nextHealth.successesToday || 0) + 1;
    nextHealth.disabledUntil = null;
  }

  nextHealth.lastCheckedAt = nowIso;
  return nextHealth;
}

/**
 * Load health map for specified sources from Supabase
 */
export async function loadSourceHealthMap(keys: string[]): Promise<Record<string, SourceHealth>> {
  if (!keys.length) return {};
  try {
    const { data, error } = await supabase
      .from("source_health")
      .select("source, status, consecutive_failures, disabled_until, last_error, last_success_at, last_checked_at, response_time_ms, failures_today, successes_today")
      .in("source", keys);

    if (error) throw error;
    if (!data) return {};

    const map: Record<string, SourceHealth> = {};
    for (const row of data) {
      map[row.source] = sanitizeSourceHealth(row.source, {
        status: row.status,
        consecutiveFailures: row.consecutive_failures,
        disabledUntil: row.disabled_until,
        lastError: row.last_error,
        lastSuccessAt: row.last_success_at,
        lastCheckedAt: row.last_checked_at,
        responseTime: row.response_time_ms,
        failuresToday: row.failures_today,
        successesToday: row.successes_today,
      });
    }
    return map;
  } catch (err: unknown) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "loadSourceHealthMap: Supabase error");
    return {};
  }
}

/**
 * Save health map to Supabase via upsert_source_health RPC
 */
export async function saveSourceHealthMap(map: Record<string, SourceHealth>, keys: string[]): Promise<void> {
  const tasks = keys
    .filter((k) => !!map[k])
    .map((k) => {
      const h = map[k];
      return supabase.rpc("upsert_source_health", {
        p_source: k,
        p_status: h.status,
        p_consecutive_failures: h.consecutiveFailures,
        p_disabled_until: h.disabledUntil ?? null,
        p_last_error: h.lastError ?? null,
        p_last_success_at: h.lastSuccessAt ?? null,
        p_last_checked_at: h.lastCheckedAt ?? null,
        p_response_time_ms: h.responseTime ?? null,
        p_failures_today: h.failuresToday,
        p_successes_today: h.successesToday,
      });
    });

  if (tasks.length > 0) {
    const results = await Promise.allSettled(tasks);
    for (const r of results) {
      if (r.status === "rejected") {
        logger.warn({ err: r.reason instanceof Error ? r.reason.message : String(r.reason) }, "saveSourceHealthMap: upsert RPC error");
      }
    }
  }
}

/**
 * Filter sources that are currently disabled or in cooldown
 */
export function getDisabledSources(healthMap: Record<string, SourceHealth>, keys: string[]): string[] {
  const disabled: string[] = [];
  const nowMs = Date.now();
  for (const key of keys) {
    const h = healthMap[key];
    if (!h) continue;
    if (isSourceInCooldown(h, nowMs)) {
      disabled.push(key);
    }
  }
  return disabled;
}

/**
 * Calculate the next health state for sources based on recent scrape results
 */
export function buildNextSourceHealthMap({
  sourceKeys,
  currentMap,
  sourceStates,
  nowIso = new Date().toISOString(),
  failureThreshold = 3,
  cooldownSeconds = 3600,
}: BuildNextSourceHealthMapOptions): Record<string, SourceHealth> {
  const next: Record<string, SourceHealth> = { ...currentMap };
  const keys = sourceKeys || Object.keys(sourceStates || {});

  for (const key of keys) {
    const state = sourceStates?.[key];
    const current = currentMap?.[key] || { 
      source: key, 
      status: "healthy" as const, 
      consecutiveFailures: 0,
      disabledUntil: null,
      lastError: null,
      lastSuccessAt: null,
      lastCheckedAt: null,
      responseTime: null,
      failuresToday: 0,
      successesToday: 0,
    };
    
    if (!state) {
      next[key] = current;
      continue;
    }

    const nextHealth: SourceHealth = { ...current };

    // Reset counters if new day
    const lastDate = current.lastCheckedAt ? new Date(current.lastCheckedAt).getUTCDate() : -1;
    const nowDate = new Date().getUTCDate();
    if (lastDate !== -1 && lastDate !== nowDate) {
      nextHealth.failuresToday = 0;
      nextHealth.successesToday = 0;
    }
    
    if (state.status === "error" || state.status === "circuit_break") {
      // Don't increment failure count for manual circuit breaks, only for actual errors
      if (state.status === "error") {
        nextHealth.consecutiveFailures = (current.consecutiveFailures || 0) + 1;
        nextHealth.failuresToday = (nextHealth.failuresToday || 0) + 1;
        nextHealth.lastError = state.error || "Unknown error";
        
        if (nextHealth.consecutiveFailures >= failureThreshold) {
          nextHealth.status = "degraded"; 
          
          // Adaptive Cooldown: Choose duration based on error type
          let baseCooldownSec = cooldownSeconds; // Default (typically 1h)
          const errUpper = (state.error || "").toUpperCase();
          
          if (errUpper.includes("429") || errUpper.includes("RATE LIMIT")) {
            baseCooldownSec = 14400; // 4 hours for rate limits
          } else if (errUpper.includes("TIMEOUT") || errUpper.includes("ETIMEDOUT")) {
            baseCooldownSec = 900; // 15 mins for transient timeouts
          }
          
      // Calculate backoff factor (max 2^5 = 32x)
          const extraFailures = Math.max(0, nextHealth.consecutiveFailures - failureThreshold);
          const backoffFactor = Math.pow(2, Math.min(extraFailures, 5));
          
      // Add +/- 10% random jitter to prevent thundering herd
          const jitter = 0.9 + Math.random() * 0.2;
          const actualCooldownSec = Math.round(baseCooldownSec * backoffFactor * jitter);
          
          nextHealth.disabledUntil = new Date(Date.now() + (actualCooldownSec * 1000)).toISOString();
          logger.info(
            { source: key, consecutiveFailures: nextHealth.consecutiveFailures, baseCooldownSec, actualCooldownSec },
            "Exponential backoff cooldown applied to health monitoring map"
          );
        }
      }
    } else if (state.status === "ok" || state.status === "healthy" || state.status === "success") {
      nextHealth.consecutiveFailures = 0;
      nextHealth.status = "healthy";
      nextHealth.lastError = null;
      nextHealth.lastSuccessAt = nowIso;
      nextHealth.successesToday = (nextHealth.successesToday || 0) + 1;
      nextHealth.disabledUntil = null;
    }

    nextHealth.lastCheckedAt = nowIso;
    if (state.responseTime !== undefined && state.responseTime !== null) {
      nextHealth.responseTime = state.responseTime;
    }
    
    next[key] = nextHealth;
  }
  return next;
}

// --- Dashboard & Monitoring Utils ---

export async function getSupabasePing(): Promise<number | null> {
  try {
    const s = Date.now();
    const { error } = await supabase.from("whitelist").select("count", { count: "exact", head: true });
    if (error) throw error;
    return Date.now() - s;
  } catch {
    return null;
  }
}

export async function getDiscordPing(): Promise<number | null> {
  try {
    const s = Date.now();
    await fetch("https://discord.com/api/v10/gateway", { method: "HEAD" });
    return Date.now() - s;
  } catch {
    return null;
  }
}

export async function getProviderMetrics() {
  try {
    await initializeAllProviders();
    return mangaProviderRegistry.getAllProviders().map(p => ({
      id: p.id,
      displayName: p.displayName,
      metrics: p.getMetrics?.() || null
    }));
  } catch {
    return [];
  }
}

export function formatResponseTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "-";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Perform a full health check of all sources and system services
 */
export async function performFullHealthCheck(): Promise<string[]> {
  const brokenLinks: string[] = [];
  try {
    await initializeAllProviders();
    const providers = mangaProviderRegistry.getAllProviders();
    
    // Check connectivity for each provider
    for (const provider of providers) {
      try {
        const p = provider as any;
        if (typeof p.checkHealth === "function") {
          await p.checkHealth();
        }
      } catch {
        // Silently catch provider health check errors
      }
    }

    // Return current broken links from app_settings
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "health:broken-links")
      .maybeSingle();
    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value);
        if (Array.isArray(parsed)) return parsed;
      } catch { /* ignore parse error */ }
    }
    
    return brokenLinks;
  } catch (err) {
    return brokenLinks;
  }
}
