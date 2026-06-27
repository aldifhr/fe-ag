import {
  getTime,
  isAfter,
  isValid,
  parseISO,
  subDays,
  subHours,
  toDate,
} from "date-fns";
import { getLogger } from "./logger.js";

const logger = getLogger({ scope: "dateUtils" });

/**
 * Parse and validate a date string or object
 * Returns Date object or null if invalid
 */
export function safeParseDate(date: any): Date | null {
  if (!date) return null;
  if (date instanceof Date) return isValid(date) ? date : null;

  try {
    const parsed = typeof date === "string" ? parseISO(date) : toDate(date);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Get timestamp in milliseconds from a date string or object
 * Returns number or NaN if invalid
 */
export function getTimestampMs(date: any): number {
  const parsed = parseDateWithFallback(date);
  return parsed ? getTime(parsed) : NaN;
}

/**
 * Check if a date is valid
 */
export function isValidDate(date: any): boolean {
  return safeParseDate(date) !== null;
}

/**
 * Calculate cutoff time for filtering
 * Returns timestamp in milliseconds
 */
export function getCutoffTime(daysBack = 30, hoursBack = 0): number {
  let result = new Date();
  if (daysBack > 0) {
    result = subDays(result, daysBack);
  }
  if (hoursBack > 0) {
    result = subHours(result, hoursBack);
  }
  return getTime(result);
}

/**
 * Check if date is within last N hours
 */
export function isWithinLastHours(date: any, hours: number): boolean {
  const parsed = safeParseDate(date);
  if (!parsed) return false;

  const cutoff = subHours(new Date(), hours);
  return isAfter(parsed, cutoff);
}

/**
 * Parse loose relative time strings (e.g., "2 hours ago", "3 days ago", "5 menit")
 * Returns Date object or null if parsing fails
 */
export function parseLooseRelativeTime(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const text = String(raw).toLowerCase().trim();
  
  // Extended regex for Shinigami ID: mnt (menit), d (hari), bln (bulan)
  const m = text.match(
    /(\d+)\s*(minute|minutes|min|menit|mnt|hour|hours|hr|jam|day|days|d|hari|week|weeks|minggu|month|months|bulan|bln)/,
  );
  if (!m) return null;

  const amount = Number.parseInt(m[1], 10);
  if (Number.isNaN(amount)) return null;

  const unit = m[2];
  let minutes = amount;
  if (unit === "hour" || unit === "hours" || unit === "hr" || unit === "jam") {
    minutes = amount * 60;
  } else if (unit === "day" || unit === "days" || unit === "d" || unit === "hari") {
    minutes = amount * 60 * 24;
  } else if (unit === "week" || unit === "weeks" || unit === "minggu") {
    minutes = amount * 60 * 24 * 7;
  } else if (unit === "month" || unit === "months" || unit === "bulan" || unit === "bln") {
    // Approximate month as 30 days
    minutes = amount * 60 * 24 * 30;
  }
  // Note: "minute|minutes|min|menit|mnt" defaults to minutes (no conversion needed)

  return new Date(Date.now() - minutes * 60 * 1000);
}

/**
 * Parse date with multiple fallback strategies (DRY principle)
 */
export function parseDateWithFallback(raw: string | null | undefined): Date | null {
  if (!raw) return null;

  return (
    safeParseDate(raw) ||
    parseLooseRelativeTime(raw)
  );
}

/**
 * Batch parse dates and return timestamps for sorting
 */
function batchParseTimestamps<T>(items: T[], dateField: keyof T): { item: T; timestampMs: number }[] {
  return items.map((item) => ({
    item,
    timestampMs: getTimestampMs(item[dateField]),
  }));
}

/**
 * Safely parse JSON with fallback (DRY pattern)
 */
export function safeJsonParse(jsonString: string | null | undefined, defaultValue: any = null): any {
  if (!jsonString) return defaultValue;
  try {
    return typeof jsonString === "string" ? JSON.parse(jsonString) : jsonString;
  } catch {
    return defaultValue;
  }
}

/**
 * Sort array by date field (descending - newest first)
 */
export function sortByDateDesc<T>(items: T[], dateField = "timestamp" as keyof T): T[] {
  return batchParseTimestamps(items, dateField)
    .filter(({ timestampMs }) => !isNaN(timestampMs))
    .sort((a, b) => b.timestampMs - a.timestampMs)
    .map(({ item }) => item);
}


