import type { CronLogEntry } from "../types.js";
import { env } from "../config/env.js";
import { supabase } from "../supabase.js";
import { normalizeCronLogEntry } from "../utils/log-helpers.js";

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

export { normalizeStatsRecord };
