import { env } from "../config/env.js";
import type {
  RedisClient,
  CronStatus,
  TimingMetrics,
  ScraperMetrics,
  SourceHealth,
} from "../types.js";

export function limitObjectArrays<T>(obj: Record<string, T[]>, limit: number): Record<string, T[]> {
  if (!obj || typeof obj !== "object" || limit <= 0) return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.slice(0, limit) : value,
    ]),
  );
}

export function shouldRunChannelValidation(
  lastValidatedAt: string | null,
  refreshSeconds = env.CHANNEL_VALIDATION_REFRESH_SECONDS,
  nowMs = Date.now(),
): boolean {
  const refreshMs = Math.max(60, Number(refreshSeconds) || 3600) * 1000;
  const lastMs = new Date(lastValidatedAt || "").getTime();
  if (!Number.isFinite(lastMs)) return true;
  return nowMs - lastMs >= refreshMs;
}

export function buildGuildChannelMap(entries: [string, string][]): Record<string, string> {
  return Object.fromEntries(
    entries.filter(([, channelId]) => Boolean(channelId)),
  );
}

export function buildShortCircuitStatus({
  reason,
  start,
  guilds = 0,
  whitelist = 0,
  scraped = 0,
  hibernated = 0,
  incrementalSaved = 0,
  scrapeMetrics = null,
  sourceHealth = {},
  timingMetrics = {} as TimingMetrics,
}: {
  reason: string;
  start: number;
  guilds?: number;
  whitelist?: number;
  scraped?: number;
  hibernated?: number;
  incrementalSaved?: number;
  scrapeMetrics?: Record<string, ScraperMetrics | null> | null;
  sourceHealth?: Record<string, SourceHealth>;
  timingMetrics?: TimingMetrics;
}): CronStatus {
  return {
    sent: 0,
    skipped: 0,
    failed: 0,
    duration: ((Date.now() - start) / 1000).toFixed(1),
    guilds,
    whitelist,
    scraped,
    hibernated,
    incrementalSaved,
    scrapeMetrics,
    timestamp: new Date().toISOString(),
    sourceHealth,
    timingMetrics: finalizeTimingMetrics(start, timingMetrics),
    outcome: "short_circuit",
    shortCircuitReason: reason,
  };
}

export function roundTimingMs(value: number): number {
  return Math.max(0, Math.round(Number(value) || 0));
}

export function finalizeTimingMetrics(start: number, partial: TimingMetrics): TimingMetrics {
  return {
    ...partial,
    totalMs: roundTimingMs(Date.now() - start),
  };
}

/**
 * No-op replacement — Supabase handles TTL/cleanup automatically.
 * Previously cleaned Redis log lists and daily stats hashes.
 */
export async function cleanupOldLogs(_redis?: RedisClient): Promise<void> {
  // Supabase manages data retention; no manual cleanup needed.
}
