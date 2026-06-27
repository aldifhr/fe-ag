import { env } from "../../shared/config/env.js";
import type {
  CronStatus,
  TimingMetrics,
  ScraperMetrics,
  SourceHealth,
} from "../../shared/types.js";

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


