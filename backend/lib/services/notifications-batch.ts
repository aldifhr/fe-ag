/**
 * Batch subscriber lookup utilities
 * Replaces N+1 query pattern with efficient batch lookups
 */

import { normalizeTitleKey } from "../../shared/domain.js";
import { arrayUnique, arrayUnion } from "../../shared/utils.js";
import { getLogger } from "../../shared/logger.js";
import { supabase } from "../supabase.js";

const logger = getLogger({ scope: "notifications:batch" });

/**
 * Batch fetch subscribers for multiple titles in one round-trip
 * Replaces N+1 getMangaSubscribers() calls with single pipeline
 */
export async function batchGetMangaSubscribers(
  titles: string[],
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();

  if (!titles.length) return result;

  // Normalize and dedupe titles
  const normalizedMap = new Map<string, string>(); // normalized -> original
  const uniqueTitles: string[] = [];

  for (const title of titles) {
    const key = normalizeTitleKey(title);
    if (key && !normalizedMap.has(key)) {
      normalizedMap.set(key, title);
      uniqueTitles.push(key);
    }
  }

  if (!uniqueTitles.length) return result;

  try {
    // Query all followers, all-mode users, and mutes in parallel
    const [followRows, allRows, muteRows] = await Promise.all([
      supabase.from("user_follows").select("title_key, user_id").in("title_key", uniqueTitles),
      supabase.from("user_all_mode").select("user_id"),
      supabase.from("manga_mutes").select("title_key, user_id").in("title_key", uniqueTitles),
    ]);

    const allModeUsers = (allRows.data || []).map((r) => r.user_id);

    // Build followers map: title_key -> user_id[]
    const followersMap = new Map<string, string[]>();
    for (const titleKey of uniqueTitles) {
      followersMap.set(titleKey, []);
    }
    if (followRows.data) {
      for (const row of followRows.data) {
        followersMap.get(row.title_key)?.push(row.user_id);
      }
    }

    // Build mutes map: title_key -> user_id[]
    const mutesMap = new Map<string, string[]>();
    for (const titleKey of uniqueTitles) {
      mutesMap.set(titleKey, []);
    }
    if (muteRows.data) {
      for (const row of muteRows.data) {
        mutesMap.get(row.title_key)?.push(row.user_id);
      }
    }

    // Combine results for each title
    for (const titleKey of uniqueTitles) {
      const originalTitle = normalizedMap.get(titleKey)!;
      const followers = followersMap.get(titleKey) || [];
      const mutes = mutesMap.get(titleKey) || [];

      // Combine native subs + all_mode, then filter mutes
      const combined = arrayUnique(arrayUnion(followers, allModeUsers));
      const muteSet = new Set(mutes);
      const filtered = combined.filter((userId: string) => !muteSet.has(userId));

      result.set(originalTitle, filtered);
    }
  } catch (err: unknown) {
    logger.error(
      { error: (err as Error).message, titleCount: titles.length },
      "batchGetMangaSubscribers failed",
    );
  }

  return result;
}

/**
 * Cache-friendly batch lookup with Map cache support
 */
export async function getSubscribersBatchWithCache(
  titles: string[],
  cache: Map<string, string[]>,
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  const missing: string[] = [];

  // Check cache first
  for (const title of titles) {
    const cached = cache.get(title);
    if (cached) {
      result.set(title, cached);
    } else {
      missing.push(title);
    }
  }

  if (!missing.length) return result;

  // Batch fetch missing
  const fetched = await batchGetMangaSubscribers(missing);

  // Populate result and cache
  for (const [title, subscribers] of fetched) {
    result.set(title, subscribers);
    cache.set(title, subscribers);
  }

  return result;
}

/**
 * Stats for batch vs individual lookup comparison
 */
export interface BatchLookupStats {
  uniqueTitles: number;
  totalChapters: number;
  cacheHits: number;
  cacheMisses: number;
}

/**
 * Calculate batch lookup savings (simplified — in-memory)
 */
export function calculateBatchSavings(
  titles: string[],
  cacheHits: number,
): BatchLookupStats {
  const uniqueTitles = new Set(titles.map(normalizeTitleKey)).size;
  const totalChapters = titles.length;
  const cacheMisses = uniqueTitles - cacheHits;

  return {
    uniqueTitles,
    totalChapters,
    cacheHits,
    cacheMisses,
  };
}
