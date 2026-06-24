import { ChapterItem } from "../../types.js";
import { supabase } from "../../supabase.js";
import { getChapterNumber } from "../../domain.js";
import { scanAndCleanupExpired } from "./history.js";
import { getLogger } from "../../logger.js";

const logger = getLogger({ scope: "dispatch" });

/**
 * Mark a chapter as sent in Supabase after successful Discord notification.
 * Calls Supabase RPCs to update dispatch_claims, title_last_chapters, and manga_last_updates.
 */
export async function markChapterSent({
  item,
  key,
  duplicateKey,
  titleKey,
  nowIso,
}: {
  item: ChapterItem;
  key: string;
  duplicateKey: string | null;
  titleKey: string;
  nowIso: string;
}): Promise<void> {
  const chapterUrl = key.startsWith("chapter:") ? key.slice("chapter:".length) : key;
  const dupUrl = duplicateKey
    ? (duplicateKey.startsWith("chapter:") ? duplicateKey.slice("chapter:".length) : duplicateKey)
    : "";

  try {
    await Promise.all([
      supabase.rpc("complete_dispatch_claim", {
        p_chapter_url: chapterUrl,
        p_duplicate_url: dupUrl,
      }),
      supabase.rpc("upsert_title_last_chapter", {
        p_title_key: titleKey,
        p_chapter_number: getChapterNumber(item.chapter) || 0,
      }),
      supabase.rpc("upsert_manga_last_update", {
        p_title_key: titleKey,
        p_updated_at: nowIso,
      }),
    ]);
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err), url: chapterUrl },
      "Failed to mark chapter as sent in Supabase",
    );
  }
}

/**
 * Fire-and-forget cleanup of expired dispatch claims via Supabase RPC.
 */
export function fireAndForgetCleanup(): void {
  Promise.resolve()
    .then(() => scanAndCleanupExpired(Date.now()))
    .catch((err: unknown) => {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "fireAndForgetCleanup failed",
      );
    });
}
