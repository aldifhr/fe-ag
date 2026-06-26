import {
  CLAIM_STATUS,
  CHAPTER_PENDING_TTL_SEC,
  ENQUEUED_EXPIRY_MS,
} from "../../config.js";
import { env } from "../../config/env.js";
import { getChapterNumber } from "../../domain.js";
import { DispatchChapterMeta, DispatchQueueState, ClaimState, ChapterItem } from "../../types.js";
import { supabase } from "../../supabase.js";
import { getLogger } from "../../logger.js";
import { safeJsonParse } from "../../dateUtils.js";
import {
  buildDispatchChapterMeta,
  preferDuplicateMeta,
} from "./meta.js";

const logger = getLogger({ scope: "dispatch:dedup" });

// Re-export for backward compatibility
export type { DispatchQueueState } from "../../types.js";

export function parseClaimState(value: unknown): ClaimState | null {
  if (!value) return null;

  const baseState: ClaimState = {
    status: null,
    claimedAt: null,
    sentAt: null,
    expiresAt: null,
  };

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      const v = typeof parsed === "object" && parsed !== null ? parsed : {};
      return {
        ...baseState,
        ...v,
        status: (v.s || v.status || baseState.status) as ClaimState["status"],
        claimedAt: v.ca || v.claimedAt || baseState.claimedAt,
        sentAt: v.sa || v.sentAt || baseState.sentAt,
        expiresAt: v.e || v.expiresAt || baseState.expiresAt,
      };
    } catch {
      return null;
    }
  }

  if (typeof value === "object" && value !== null) {
    const v = value as Record<string, any>;
    return {
      status: (v.s || v.status) as ClaimState["status"] || null,
      claimedAt: v.ca || v.claimedAt || null,
      sentAt: v.sa || v.sentAt || null,
      expiresAt: v.e || v.expiresAt || null,
    };
  }

  return null;
}

/**
 * Check if an existing claim is still blocking a new dispatch
 */
export function isBlockingClaim(
  value: unknown,
  pendingStaleMs: number = CHAPTER_PENDING_TTL_SEC * 1000,
  nowMs: number = Date.now()
): boolean {
  const claim = parseClaimState(value);
  if (!claim || !claim.status) return false;

  if (claim.status === CLAIM_STATUS.SENT) return true;

  if (claim.status === CLAIM_STATUS.PENDING) {
    // Align with Lua script: block if expiresAt is in the future
    if (claim.expiresAt) return claim.expiresAt > nowMs;
    // Fallback: use claimedAt age if expiresAt not present (legacy records)
    if (!claim.claimedAt) return false;
    return nowMs - new Date(claim.claimedAt).getTime() < pendingStaleMs;
  }

  if (claim.status === CLAIM_STATUS.ENQUEUED) {
    if (!claim.expiresAt) return true; // Default to blocking if no expiry
    return claim.expiresAt > nowMs;
  }

  return false;
}

/**
 * Classify the state of a claim for observability breakdown.
 * Returns "sent", "pending", "other", or null (no claim / unknown).
 */
export function classifyBlockingClaim(
  value: unknown
): "sent" | "pending" | "other" | null {
  const claim = parseClaimState(value);
  if (!claim || !claim.status) return null;
  if (claim.status === CLAIM_STATUS.SENT) return "sent";
  if (claim.status === CLAIM_STATUS.PENDING) return "pending";
  if (claim.status === CLAIM_STATUS.ENQUEUED) return "other";
  return "other";
}

/**
 * Map a Supabase dispatch_claims row to a format parseClaimState understands
 */
function claimRowToValue(row: { status: string; expires_at?: string | null; claimed_at?: string | null; sent_at?: string | null }): Record<string, unknown> {
  return {
    s: row.status,
    ca: row.claimed_at,
    sa: row.sent_at,
    e: row.expires_at,
    status: row.status,
    claimedAt: row.claimed_at,
    sentAt: row.sent_at,
    expiresAt: row.expires_at,
  };
}

/**
 * Fetch claim statuses from Supabase for a list of chapter URLs
 */
async function fetchClaimStatuses(urls: string[]): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  if (!urls.length) return map;

  try {
    const { data } = await supabase
      .from("dispatch_claims")
      .select("chapter_url, status, expires_at, claimed_at, sent_at")
      .in("chapter_url", urls);

    if (data) {
      for (const row of data) {
        map.set(row.chapter_url, claimRowToValue(row));
      }
    }
  } catch (err) {
    logger.warn({ err }, "Failed to fetch claim statuses from Supabase");
  }

  return map;
}

/**
 * Query title_last_chapters from Supabase for a set of title keys
 */
async function fetchLastChapters(titleKeys: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!titleKeys.length) return map;

  try {
    const { data } = await supabase
      .from("title_last_chapters")
      .select("title_key, chapter_number")
      .in("title_key", titleKeys);

    if (data) {
      for (const row of data) {
        map.set(row.title_key, row.chapter_number);
      }
    }
  } catch (err) {
    logger.warn({ err }, "Failed to fetch last chapters from Supabase");
  }

  return map;
}

/**
 * Query manga_last_updates from Supabase for a set of title keys
 */
async function fetchLastUpdates(titleKeys: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!titleKeys.length) return map;

  try {
    const { data } = await supabase
      .from("manga_last_updates")
      .select("title_key, updated_at")
      .in("title_key", titleKeys);

    if (data) {
      for (const row of data) {
        map.set(row.title_key, row.updated_at);
      }
    }
  } catch (err) {
    logger.warn({ err }, "Failed to fetch last updates from Supabase");
  }

  return map;
}

/**
 * Build a map of duplicate keys to their existing Redis values
 */
export function buildDuplicateFlagMap(
  duplicateKeys: string[],
  duplicateValues: (ClaimState | string | null)[],
): Map<string, ClaimState | string | null> {
  return new Map(
    duplicateKeys.map((key, index) => [key, duplicateValues[index] ?? null]),
  );
}

/**
 * Filter for meta entries that aren't already blocked by history or cross-source dedupe
 */
export function filterClaimableMeta(
  validChapterMeta: DispatchChapterMeta[],
  existingFlags: (ClaimState | string | null)[],
  duplicateFlagMap: Map<string, ClaimState | string | null>,
  pendingStaleMs: number,
  nowMs: number,
): DispatchChapterMeta[] {
  return validChapterMeta.filter(
    (entry, i) =>
      !isBlockingClaim(existingFlags[i]) &&
      (!entry.duplicateKey ||
        !isBlockingClaim(
          duplicateFlagMap.get(entry.duplicateKey)
        )),
  );
}

/**
 * Select the best version (canonical) for each group of duplicate chapters
 */
export function selectPreferredEntries(claimableMeta: DispatchChapterMeta[]) {
  const preferredByDuplicateKey = new Map<string, DispatchChapterMeta>();
  let duplicateCount = 0;

  for (const entry of claimableMeta) {
    if (!entry.duplicateKey) continue;

    const existing = preferredByDuplicateKey.get(entry.duplicateKey);
    if (!existing) {
      preferredByDuplicateKey.set(entry.duplicateKey, entry);
      continue;
    }

    duplicateCount++;
    preferredByDuplicateKey.set(
      entry.duplicateKey,
      preferDuplicateMeta(existing, entry),
    );
  }

  return { preferredByDuplicateKey, duplicateCount };
}

/**
 * Build the final deduped queue
 */
export function buildDedupedQueue(
  claimableMeta: DispatchChapterMeta[],
  preferredByDuplicateKey: Map<string, DispatchChapterMeta>,
): DispatchChapterMeta[] {
  const injectedDuplicateKeys = new Set<string>();

  return claimableMeta.reduce((deduped, entry) => {
    if (!entry.duplicateKey) {
      deduped.push(entry);
      return deduped;
    }

    const preferred = preferredByDuplicateKey.get(entry.duplicateKey);
    if (preferred !== entry || injectedDuplicateKeys.has(entry.duplicateKey)) {
      return deduped;
    }

    injectedDuplicateKeys.add(entry.duplicateKey);
    deduped.push(entry);
    return deduped;
  }, [] as DispatchChapterMeta[]);
}

/**
 * Helper to safely handle hmget results from a pipeline (Array or Object)
 */
function parseHmgetPipelineResult(
  keys: string[],
  raw: unknown
): (ClaimState | string | null)[] {
  if (!keys.length) return [];
  
  let results = raw;

  if (results && typeof results === "object" && !Array.isArray(results)) {
    results = keys.map((k) => (results as Record<string, unknown>)[k]);
  }

  return ((results as unknown[]) || []).map((j: unknown) => {
    if (typeof j === "string") return safeJsonParse(j, j);
    return j;
  }) as (ClaimState | string | null)[];
}

/**
 * Prepare dispatch queue with comprehensive deduplication
 * 
 * This function is the heart of the deduplication system. It:
 * 1. Builds chapter metadata with unique keys
 * 2. Fetches existing state from Redis (SENT/PENDING)
 * 3. Checks cross-source duplicates (ikiru vs shinigami)
 * 4. Filters out already-sent or pending chapters
 * 5. Selects preferred source for duplicates
 * 6. Enforces max queue size limit
 * 7. Provides detailed skip breakdown for observability
 * 
 * **Deduplication Strategy:**
 * - Same chapter key → Skip if SENT or PENDING
 * - Duplicate key (cross-source) → Skip if duplicate is SENT/PENDING
 * - Stale PENDING → Allow retry after TTL expires
 * - Prefer newer source when both available
 * 
 * @param matched - Array of matched chapters from scrapers
 * @param maxItems - Maximum items to queue (default: Infinity)
 * @param pendingStaleMs - TTL for PENDING state in milliseconds (default: 600000)
 * 
 * @returns Queue state with queued items and skip breakdown
 * );
 * 
 * console.log(`Queued: ${queueState.queuedMeta.length}`);
 * console.log(`Skipped (duplicate): ${queueState.duplicateCount}`);
 * console.log(`Skipped (already sent): ${queueState.alreadySentCount}`);
 * ```
 */
export async function prepareDispatchQueue(
  matched: ChapterItem[] = [],
  maxItems = Infinity,
  pendingStaleMs = CHAPTER_PENDING_TTL_SEC * 1000,
): Promise<DispatchQueueState> {
  const chapterMeta = buildDispatchChapterMeta(matched);
  const validChapterMeta = chapterMeta.filter(
    (entry) => entry.key,
  ) as DispatchChapterMeta[];

  const keys = validChapterMeta.map((entry) => entry.key!);
  const duplicateKeys = [
    ...new Set(
      validChapterMeta.map((e) => e.duplicateKey).filter(Boolean) as string[],
    ),
  ];

  const titleKeys = [...new Set(validChapterMeta.map((e) => e.item.titleKey).filter(Boolean) as string[])];

  // Build the set of all URLs to look up in dispatch_claims
  const allClaimUrls = [
    ...new Set([
      ...keys.map(k => k.startsWith("chapter:") ? k.slice("chapter:".length) : k),
      ...duplicateKeys.map(k => k.startsWith("chapter:") ? k.slice("chapter:".length) : k),
    ]),
  ];

  // Fetch all data from Supabase in parallel
  const [claimsMap, lastChapterMap, lastUpdateMap] = await Promise.all([
    fetchClaimStatuses(allClaimUrls),
    fetchLastChapters(titleKeys),
    fetchLastUpdates(titleKeys),
  ]);

  // Build existingFlags array matching the old Redis format
  const existingFlags = validChapterMeta.map((entry) => {
    const rawKey = entry.key?.startsWith("chapter:") ? entry.key.slice("chapter:".length) : entry.key;
    return rawKey ? (claimsMap.get(rawKey) ?? null) : null;
  });

  // Build duplicateValues array
  const duplicateValues = duplicateKeys.map((key) => {
    const rawKey = key.startsWith("chapter:") ? key.slice("chapter:".length) : key;
    return claimsMap.get(rawKey) ?? null;
  }) as unknown as (ClaimState | string | null)[];

  const duplicateFlagMap = buildDuplicateFlagMap(
    duplicateKeys,
    duplicateValues,
  );

  // 3. CHECK SUPABASE (Hybrid Deduplication)
  // Check if any of these chapters are already in Supabase 'dispatch_history'
  // Redis keys use "chapter:${normalizedUrl}" format, but Supabase stores raw URLs
  const allPossibleKeys = [...new Set([...keys, ...duplicateKeys])];
  const supabaseSentKeys = new Set<string>();
  if (allPossibleKeys.length > 0) {
    try {
      // Strip "chapter:" prefix to match Supabase's raw URL format
      const supabaseQueryKeys = allPossibleKeys
        .map(k => k.startsWith("chapter:") ? k.slice("chapter:".length) : k)
        .filter(k => !k.includes(":")); // Exclude dedup keys (chapter:dedupe:...)
      
      if (supabaseQueryKeys.length > 0) {
        const { data: dbSent } = await supabase
          .from('dispatch_history')
          .select('chapter_url')
          .in('chapter_url', supabaseQueryKeys);
        
        if (dbSent) {
          dbSent.forEach(row => supabaseSentKeys.add(row.chapter_url));
        }
      }
    } catch (err) {
      logger.warn({ err: err instanceof Error ? err.message : String(err) }, "Supabase check failed, continuing without dedup");
    }
  }

  const nowMs = Date.now();
  let staleCount = 0;
  const alreadyStateBreakdown = {
    sent: 0,
    pending: 0,
    other: 0,
    duplicateSent: 0,
    duplicatePending: 0,
    duplicateOther: 0,
  };
  const alreadyStateBySource: Record<string, number> = {};
  const blockedSample: any[] = [];
  const blockedSampleLimit = 8;

  for (let i = 0; i < validChapterMeta.length; i++) {
    const entry = validChapterMeta[i];
    const source = entry?.item?.source || "unknown";
    const localState = classifyBlockingClaim(
      existingFlags[i]
    );
    const dupState = classifyBlockingClaim(
      entry.duplicateKey ? duplicateFlagMap.get(entry.duplicateKey) : null
    );

    // Hybrid: Mark as SENT if found in Supabase
    // entry.key is "chapter:${normalizedUrl}", but supabaseSentKeys contains raw URLs
    const rawKey = entry.key?.startsWith("chapter:") ? entry.key.slice("chapter:".length) : entry.key;
    const isSupabaseSent = (rawKey && supabaseSentKeys.has(rawKey)) || (entry.duplicateKey && supabaseSentKeys.has(entry.duplicateKey));

    if (localState === "sent" || isSupabaseSent) {
      alreadyStateBreakdown.sent += 1;
    } else if (localState === "pending") {
      alreadyStateBreakdown.pending += 1;
    } else if (localState === "other") {
      alreadyStateBreakdown.other += 1;
    } else if (dupState === "sent") {
      alreadyStateBreakdown.duplicateSent += 1;
    } else if (dupState === "pending") {
      alreadyStateBreakdown.duplicatePending += 1;
    } else if (dupState === "other") {
      alreadyStateBreakdown.duplicateOther += 1;
    }

    if (localState || dupState || isSupabaseSent) {
      alreadyStateBySource[source] = (alreadyStateBySource[source] || 0) + 1;
      if (blockedSample.length < blockedSampleLimit) {
        blockedSample.push({
          source,
          title: entry?.item?.title || null,
          chapter: entry?.item?.chapter || null,
          reason: isSupabaseSent ? "supabase_sent" : (localState ? `local_${localState}` : `duplicate_${dupState}`),
        });
      }
    }
  }

  // Filter claimable: 
  // 1. Must NOT be in Redis SENT/PENDING
  // 2. Must NOT be in Supabase
  // 3. Must NOT be older than already dispatched chapters
  const claimableMeta = validChapterMeta.filter(
    (entry, i) => {
      // Basic Redis/Supabase checks
      const rawEntryKey = entry.key?.startsWith("chapter:") ? entry.key.slice("chapter:".length) : entry.key;
      const isBlocked = isBlockingClaim(existingFlags[i]) || 
                       (rawEntryKey && supabaseSentKeys.has(rawEntryKey)) ||
                       (entry.duplicateKey && (isBlockingClaim(duplicateFlagMap.get(entry.duplicateKey)) || supabaseSentKeys.has(entry.duplicateKey)));
      
      if (isBlocked) return false;

      // Latest chapter check
      if (entry.item.titleKey) {
        const lastNum = lastChapterMap.get(entry.item.titleKey);
        if (lastNum !== undefined) {
          const currentNum = getChapterNumber(entry.item.chapter);
          if (currentNum !== null && currentNum <= lastNum) {
            // Even if it's not in history, we skip it if a newer one was already sent
            return false;
          }
        }
      }

      // Whitelist Addition Time check: Skip chapters released BEFORE addition
      if (entry.item.titleKey && entry.item.updatedTime) {
        const addedAtStr = lastUpdateMap.get(entry.item.titleKey);
        if (addedAtStr) {
          try {
            const addedAt = new Date(addedAtStr).getTime();
            const updatedAt = new Date(entry.item.updatedTime).getTime();
            
            // If updated before added (with 5-minute buffer for safety), we usually skip.
            // BUT: If this is the HIGHEST chapter in the current batch for this title, 
            // we allow it as a "Welcome" notification, provided it's still "fresh" (within 24h).
            if (updatedAt < addedAt - 300000) {
              const currentNum = getChapterNumber(entry.item.chapter);
              const titleChapters = validChapterMeta.filter(m => m.item.titleKey === entry.item.titleKey);
              const maxNumInBatch = Math.max(...titleChapters.map(m => getChapterNumber(m.item.chapter) || 0));

              if (currentNum === null || currentNum < maxNumInBatch) {
                staleCount++;
                if (blockedSample.length < blockedSampleLimit) {
                  blockedSample.push({
                    source: entry.item.source,
                    title: entry.item.title,
                    chapter: entry.item.chapter,
                    reason: "pre_whitelist_addition",
                  });
                }
                return false;
              }
              // Else: It's the max chapter, let it proceed to the 24h fresh check
            }
          } catch (e) {
            // Invalid date, ignore
          }
        }
      }


      // Fresh 24 hours filter
      if (entry.item.updatedTime) {
        try {
          const updatedDate = new Date(entry.item.updatedTime);
          const now = Date.now();
          const ageMs = now - updatedDate.getTime();
          const maxAgeMs = 24 * 60 * 60 * 1000; // 24 hours
          
          if (ageMs > maxAgeMs) {
            staleCount++;
            if (blockedSample.length < blockedSampleLimit) {
              blockedSample.push({
                source: entry.item.source,
                title: entry.item.title,
                chapter: entry.item.chapter,
                reason: "stale_over_24h",
              });
            }
            return false;
          }
        } catch (e) {
          // If date is invalid, we continue
        }
      }

      return true;
    }
  );

  // 4. ALLOW ALL CHAPTERS IN BATCH
  // We no longer filter for 'latest only' in a single batch to ensure that
  // simultaneous updates (e.g. chapters 55 & 56) both get notified.
  const batchFilteredMeta = claimableMeta;

  const { preferredByDuplicateKey, duplicateCount } =
    selectPreferredEntries(batchFilteredMeta);
  const dedupedMeta = buildDedupedQueue(batchFilteredMeta, preferredByDuplicateKey);

  const limit = Math.min(
    maxItems,
    env.DISPATCH_MAX_ITEMS,
  );

  const queuedMeta = dedupedMeta.slice(0, limit);

  return {
    invalidCount: chapterMeta.length - validChapterMeta.length,
    alreadySentCount: validChapterMeta.length - claimableMeta.length - staleCount,
    staleCount,
    unsentMeta: claimableMeta,
    queuedMeta,
    alreadyStateBreakdown,
    alreadyStateBySource,
    blockedSample,
    duplicateCount,
    overLimitCount: Math.max(0, dedupedMeta.length - queuedMeta.length),
  };
}
