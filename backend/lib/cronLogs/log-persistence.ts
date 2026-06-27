import { supabase } from "../supabase.js";
import { env } from "../../shared/config/env.js";
import { normalizeCronLogEntry } from "../utils/log-helpers.js";
import { cronDailyStatsKey, normalizeStatsRecord } from "./daily-stats.js";
import { isThrottled, setThrottle, buildThrottleKey } from "./throttle.js";
import type { CronLogEntry } from "../../shared/types.js";

function shouldPersistRawCronLog(entry?: Record<string, unknown>): boolean {
  const normalized = normalizeCronLogEntry(entry);
  if (normalized.type === "short_circuit") return true;
  if (["sent", "failed", "partial", "skipped", "info"].includes(normalized.tag || "")) return true;
  if (normalized.code === "cron_fatal") return true;
  return false;
}

/**
 * Increment daily counters for a log entry — Supabase-only.
 */
export async function appendCronDailyStats(entry?: Record<string, unknown>): Promise<void> {
  const payload = normalizeCronLogEntry(entry);
  const key = cronDailyStatsKey(payload.timestamp);

  const count = Number(payload.count);
  const failed = Number(payload.failed);
  const skipped = Number((payload as Record<string, unknown>).skipped);

  // Use Supabase RPC or direct upsert with increment
  // We use a simple read-then-upsert pattern acceptable for single-instance
  let existing: Record<string, unknown> = {};
  try {
    const { data } = await supabase
      .from('scraper_stats')
      .select('raw_data')
      .eq('date', key)
      .single();
    if (data?.raw_data) {
      existing = data.raw_data as Record<string, unknown>;
    }
  } catch {
    // First entry for this date
  }

  const next: Record<string, number> = { ...existing as Record<string, number> };
  next.events_total = (next.events_total || 0) + 1;
  next[`tag:${payload.tag || "info"}`] = (next[`tag:${payload.tag || "info"}`] || 0) + 1;

  if (payload.code) {
    next[`code:${payload.code}`] = (next[`code:${payload.code}`] || 0) + 1;
  }
  if (payload.type) {
    next[`type:${payload.type}`] = (next[`type:${payload.type}`] || 0) + 1;
  }
  if (payload.source) {
    next[`source:${payload.source}`] = (next[`source:${payload.source}`] || 0) + 1;
    if (payload.tag) {
      next[`source:${payload.source}:tag:${payload.tag}`] = (next[`source:${payload.source}:tag:${payload.tag}`] || 0) + 1;
    }
  }

  if (Number.isFinite(count) && count > 0) {
    next.chapters_sent = (next.chapters_sent || 0) + count;
  }
  if (Number.isFinite(failed) && failed > 0) {
    next.delivery_failed = (next.delivery_failed || 0) + failed;
  }
  if (Number.isFinite(skipped) && skipped > 0) {
    next.chapters_skipped = (next.chapters_skipped || 0) + skipped;
  }

  try {
    const { error } = await supabase.from('scraper_stats').upsert({
      date: key,
      sent: Number(next.chapters_sent || 0),
      skipped: Number(next.chapters_skipped || 0),
      failed: Number(next.chapters_failed || 0),
      scraped: Number(next.events_total || 0),
      raw_data: next,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'date' });
    if (error) throw error;
  } catch (err) {
    // console.error("[appendCronDailyStats] Supabase sync failed:", err);
  }
}

/**
 * Append a permanent log entry and update daily stats — Supabase-only.
 */
export async function appendCronLog(entry?: Record<string, unknown>): Promise<boolean> {
  const payload = normalizeCronLogEntry(entry);
  await appendCronDailyStats(payload);

  if (!shouldPersistRawCronLog(payload)) return false;

  try {
    await supabase.from('cron_logs').insert({
      timestamp: payload.timestamp,
      tag: payload.tag,
      code: payload.code,
      type: payload.type,
      source: payload.source,
      title: payload.title,
      count: payload.count,
      sent: payload.sent,
      skipped: payload.skipped,
      failed_count: payload.failed,
      message: payload.message,
      raw_payload: payload
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cronLogs] persistence failed: ${msg}`);
    return false;
  }
  return true;
}

/**
 * Append a log entry only if it's not throttled — in-memory throttle.
 */
export async function appendCronLogThrottled(
  entry?: Record<string, unknown>,
  throttleSec = 0,
): Promise<boolean> {
  const normalized = normalizeCronLogEntry(entry);
  const safeThrottleSec = Math.max(0, Math.floor(Number(throttleSec) || 0));

  if (safeThrottleSec <= 0) {
    return appendCronLog(normalized);
  }

  const throttleKey = buildThrottleKey(normalized);

  if (isThrottled(throttleKey)) {
    // If throttled, we still count the run in daily stats
    await appendCronDailyStats(normalized);
    return false;
  }

  setThrottle(throttleKey, safeThrottleSec);
  return appendCronLog(normalized);
}
