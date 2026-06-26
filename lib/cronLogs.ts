import { CronLogEntry } from "./types.js";
import { env } from "./config/env.js";
import { supabase } from "./supabase.js";
import { normalizeCronLogEntry } from "./utils/log-helpers.js";
export { normalizeCronLogEntry };

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

/**
 * Appends a log entry to Supabase cron_logs.
 */

function formatDateKey(rawTime: string | number | Date | null = null): string {
  const value = rawTime ? new Date(rawTime) : new Date();
  if (Number.isNaN(value.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

interface TimestampContainer {
  timestamp?: string;
  time?: string;
  createdAt?: string;
}

function isTimestampContainer(obj: unknown): obj is TimestampContainer {
  return obj !== null && typeof obj === "object" && !(obj instanceof Date);
}

/**
 * Get the daily stats storage key for a timestamp.
 */
export function cronDailyStatsKey(rawTime: string | number | Date | TimestampContainer | null = null): string {
  let actualTime: string | number | Date | null = null;
  if (isTimestampContainer(rawTime)) {
    actualTime = rawTime.timestamp ?? rawTime.time ?? rawTime.createdAt ?? null;
  } else {
    actualTime = rawTime;
  }
  return formatDateKey(actualTime);
}

export interface CronDailyStats {
  date: string;
  runs: number;
  sentLogs: number;
  partialLogs: number;
  failedLogs: number;
  skippedLogs: number;
  shortCircuits: number;
  chaptersSent: number;
  chaptersSkipped: number;
  deliveryFailed: number;
  raw: Record<string, unknown>;
}

function normalizeStatsRecord(date: string, raw: Record<string, unknown> | null = null): CronDailyStats {
  const input = raw && typeof raw === "object" ? raw : {};
  return {
    date,
    runs: Number(input.events_total || 0),
    sentLogs: Number(input["tag:sent"] || 0),
    partialLogs: Number(input["tag:partial"] || 0),
    failedLogs: Number(input["tag:failed"] || 0),
    skippedLogs: Number(input["tag:skipped"] || 0),
    shortCircuits: Number(input["type:short_circuit"] || 0),
    chaptersSent: Number(input.chapters_sent || 0),
    chaptersSkipped: Number(input.chapters_skipped || 0),
    deliveryFailed: Number(input.delivery_failed || 0),
    raw: input,
  };
}

/**
 * Read historical daily stats from Supabase.
 */
export async function readCronDailyStats(
  days = 30,
  endDate = new Date(),
  includeEmpty = false,
): Promise<CronDailyStats[]> {
  const safeDays = Math.max(1, Math.min(90, Math.floor(Number(days) || 30)));
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return [];

  const dates: string[] = [];
  for (let offset = safeDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - offset);
    dates.push(formatDateKey(date));
  }

  // Primary: read from Supabase
  const rows: CronDailyStats[] = [];
  try {
    const { data: dbStats } = await supabase
      .from('scraper_stats')
      .select('*')
      .in('date', dates);

    const statsMap = new Map<string, NonNullable<typeof dbStats>[number]>();
    if (dbStats) {
      for (const row of dbStats) {
        statsMap.set(row.date, row);
      }
    }

    for (const date of dates) {
      const dbRow = statsMap.get(date);
      if (dbRow && dbRow.raw_data) {
        rows.push(normalizeStatsRecord(date, dbRow.raw_data as Record<string, unknown>));
      } else if (includeEmpty) {
        rows.push(normalizeStatsRecord(date));
      }
    }
  } catch (err) {
    // console.error("[readCronDailyStats] Supabase query failed:", err);
    // Fallback: return empty rows
    for (const date of dates) {
      if (includeEmpty) rows.push(normalizeStatsRecord(date));
    }
  }

  if (includeEmpty) return rows;

  return rows.filter(
    (row: CronDailyStats) =>
      row.runs > 0 ||
      row.sentLogs > 0 ||
      row.partialLogs > 0 ||
      row.failedLogs > 0 ||
      row.skippedLogs > 0 ||
      row.shortCircuits > 0 ||
      row.chaptersSent > 0 ||
      row.deliveryFailed > 0,
  );
}

function shouldPersistRawCronLog(entry?: Record<string, unknown>): boolean {
  const normalized = normalizeCronLogEntry(entry);
  if (normalized.type === "short_circuit") return true;
  if (["sent", "failed", "partial", "skipped", "info"].includes(normalized.tag || "")) return true;
  if (normalized.code === "cron_fatal") return true;
  return false;
}

/**
 * Increment daily counters for a log entry Ã¢â‚¬â€ Supabase-only.
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
 * Append a permanent log entry and update daily stats Ã¢â‚¬â€ Supabase-only.
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

function buildThrottleKey(entry?: Record<string, unknown>): string {
  const normalized = normalizeCronLogEntry(entry);
  return [
    normalized.source || "unknown",
    normalized.code || "no_code",
    normalized.type || "no_type",
  ].join(":");
}

/**
 * Append a log entry only if it's not throttled Ã¢â‚¬â€ in-memory throttle.
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

/**
 * Classify error type from message or source.
 */
export function classifyErrorType(message = "", source = ""): string {
  const text = `${message} ${source}`.toLowerCase();
  if (text.includes(" 403") || text.includes("forbidden")) return "discord_403";
  if (text.includes(" 404") || text.includes("not found")) return "discord_404";
  if (text.includes(" 429") || text.includes("rate limit"))
    return "discord_429";
  if (
    text.includes("timeout") ||
    text.includes("timed out") ||
    text.includes("etimedout")
  ) {
    return "source_timeout";
  }
  if (
    text.includes("parse") ||
    text.includes("selector") ||
    text.includes("cheerio")
  ) {
    return "source_parse";
  }
  if (text.includes("failed") || text.includes("error")) return "runtime_error";
  return "other_error";
}

interface ErrorWithResponse {
  message?: string;
  response?: { status?: number };
}

function hasResponseProperty(err: unknown): err is ErrorWithResponse {
  return err !== null && typeof err === "object" && "response" in err;
}

/**
 * Build a structured error log entry.
 */
export function buildCronErrorLog(err: Error | ErrorWithResponse | unknown, extra?: Record<string, unknown>): CronLogEntry {
  const safeExtra = extra ?? {};
  let message = "Unknown error";

  if (err instanceof Error) {
    message = err.message;
  } else if (typeof err === "object" && err !== null) {
    const errWithMsg = err as { message?: string };
    message = errWithMsg.message ?? String(err);
  } else {
    message = String(err || "Unknown error");
  }

  let status: number | null = null;
  if (hasResponseProperty(err)) {
    status = err.response?.status ?? null;
  }
  if (status === null) {
    status = (safeExtra.statusCode as number | null) ?? null;
  }

  const source = (safeExtra.source as string | null) ?? null;
  const type = (safeExtra.type as string) || classifyErrorType(message, source || "");

  return normalizeCronLogEntry({
    tag: (safeExtra.tag as string) || "failed",
    code: (safeExtra.code as string) || (status ? `http_${status}` : type),
    type,
    source,
    title: (safeExtra.title as string | null) || null,
    message,
    time: (safeExtra.time as string) || new Date().toISOString(),
  });
}
