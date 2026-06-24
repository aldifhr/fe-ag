import { getLogger } from "../../logger.js";
import { normalizeCronLogEntry } from "../../cronLogs.js";
import { compactArray } from "../../utils.js";
import { ChapterItem, CronLogEntry } from "../../types.js";
import { supabase } from "../../supabase.js";

const logger = getLogger({ scope: "dispatch" });
export const LOG_SUMMARY_SAMPLE_LIMIT = 3;

/**
 * Filter expired chapters from the history map by scanning the hash.
 * Delegates to the `cleanup_expired_dispatch_claims` RPC which handles
 * selection and deletion in a single transaction.
 */
export async function scanAndCleanupExpired(
  nowMs: number,
): Promise<string[]> {
  try {
    const { error } = await supabase.rpc("cleanup_expired_dispatch_claims");

    if (error) {
      logger.warn({ err: error.message }, "cleanup_expired_dispatch_claims RPC failed");
    }

    // The RPC handles cleanup internally; no keys to return.
    return [];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ err: message }, "Error calling cleanup_expired_dispatch_claims");
    return [];
  }
}

/**
 * Build a summary of results for the cron log after dispatching.
 */
export function buildCronLogSummary(
  items: ChapterItem[] = [],
  failed = 0,
  nowIso = new Date().toISOString(),
): CronLogEntry | null {
  // Always create a log entry - even when nothing was sent (skipped)
  const sample = compactArray(
    items
      .slice(0, LOG_SUMMARY_SAMPLE_LIMIT)
      .map((item) => `${item.title} ${item.chapter}`.trim()),
  );
  const remainder = Math.max(0, items.length - sample.length);
  const detailText = sample.length
    ? `: ${sample.join(", ")}${remainder ? ` (+${remainder} lagi)` : ""}`
    : "";
  const failedText = failed > 0 ? ` | failed=${failed}` : "";

  // Determine tag based on what happened
  let tag: string;
  let code: string;
  let message: string;
  
  if (items.length === 0 && failed <= 0) {
    // Nothing sent, nothing failed = skipped
    tag = "skipped";
    code = "dispatch_skipped";
    message = "Cron completed - no new chapters to notify";
  } else if (failed > 0) {
    // Some succeeded, some failed
    tag = "partial";
    code = "dispatch_partial";
    message = `Cron sent ${items.length} chapter(s)${failedText}${detailText}`;
  } else {
    // All succeeded
    tag = "sent";
    code = "dispatch_sent";
    message = `Cron sent ${items.length} chapter(s)${detailText}`;
  }

  return {
    ...normalizeCronLogEntry({
      time: nowIso,
      message,
      tag,
      code,
      type: "delivery_summary",
      source: "dispatch",
    }),
    count: items.length,
    failed,
    titles: compactArray(items.slice(0, 10).map((item) => item.title)),
  };
}
