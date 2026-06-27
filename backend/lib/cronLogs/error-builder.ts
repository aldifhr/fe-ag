import { normalizeCronLogEntry } from "../utils/log-helpers.js";
import type { CronLogEntry } from "../../shared/types.js";

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
