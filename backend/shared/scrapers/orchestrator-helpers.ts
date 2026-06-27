/**
 * Orchestrator Helper Functions
 * Extracted from orchestrator.ts to reduce complexity and improve testability
 */

import { ChapterItem, OrchestrateOptions, SourceHealth } from "../types.js";
import { normalizeSourceUrl, normalizeTitleKey, compactTitleKey, fuzzyTitleSimilarity } from "./shared.js";
import { batchGetMangaMetadata } from "../../lib/services/storage.js";
import { getLogger } from "../logger.js";

const logger = getLogger({ scope: "orchestrator:helpers" });

const HIBERNATION_THRESHOLD_DAYS = 10;
const HIBERNATION_WAKE_PROBABILITY = 0.05;
const INCREMENTAL_SKIP_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

export interface PreferredSecondaryMatcher {
  titleKeys: Set<string>;
  urlKeys: Set<string>;
  urlTitleMap: Map<string, string>;
}

/**
 * Get titles that should be hibernated (skipped) based on last update time
 */
export async function getHibernatingTitleKeys(
  _titleKeys: string[],
  _options: OrchestrateOptions = {}
): Promise<Set<string>> {
  
  return new Set();
}

export async function applyIncrementalFilter(
  titleKeys: Set<string>,
  _batchGetLastScrapeChecks: (keys: string[]) => Promise<(string | null)[]>
): Promise<Set<string>> {
  
  return titleKeys;
}

/**
 * Build preferred secondary matcher from titles, urls, and entries
 */
export function buildPreferredSecondaryMatcher(
  titles: string[] = [],
  urls: string[] = [],
  entries: { title: string; url: string }[] = []
): PreferredSecondaryMatcher {
  const normalizedEntries = Array.isArray(entries)
    ? entries
      .map((entry) => ({
        title: String(entry?.title || "").trim(),
        url: normalizeSourceUrl(entry?.url || ""),
      }))
      .filter((entry): entry is { title: string; url: string } => !!(entry.title && entry.url))
    : [];

  const urlTitleMap = new Map(
    normalizedEntries.map((entry) => [entry.url, entry.title])
  );

  return {
    titleKeys: new Set(
      [...(Array.isArray(titles) ? titles : []), ...normalizedEntries.map((e) => e.title)]
        .map((title) => normalizeTitleKey(title))
        .filter((tk): tk is string => !!tk)
    ),
    urlKeys: new Set(
      [...(Array.isArray(urls) ? urls : []), ...normalizedEntries.map((e) => e.url)]
        .map((url) => normalizeSourceUrl(url))
        .filter((uk): uk is string => !!uk)
    ),
    urlTitleMap,
  };
}

/**
 * Check if preferred secondary matcher has any entries
 */
export function hasPreferredSecondaryMatcher(preferredMatcher: PreferredSecondaryMatcher): boolean {
  return Boolean(
    preferredMatcher &&
    (preferredMatcher.titleKeys?.size > 0 || preferredMatcher.urlKeys?.size > 0)
  );
}

/**
 * Filter chapters to only include whitelisted titles/urls
 */
export function filterWhitelistedChapters(
  chapters: ChapterItem[],
  whitelistTitles: Set<string>,
  whitelistUrls: Set<string>
): ChapterItem[] {
  const compactWhitelistTitles = new Set(
    Array.from(whitelistTitles).map(t => compactTitleKey(t))
  );

  return chapters.filter(ch => {
    const rawTitle = ch.title || "";
    const tk = (ch as ChapterItem & { titleKey?: string }).titleKey || normalizeTitleKey(rawTitle);
    const ck = compactTitleKey(rawTitle);
    const uk = normalizeSourceUrl(ch.mangaUrl || "");
    
    // 1. Exact Title Key Match
    if (tk && whitelistTitles.has(tk)) return true;
    
    // 2. Compact Title Match (ignores spaces/symbols)
    if (ck && compactWhitelistTitles.has(ck)) return true;
    
    // 3. URL Match
    if (uk && whitelistUrls.has(uk)) return true;
    
    // 4. Fuzzy Match Fallback (more expensive, but robust)
    for (const wtk of whitelistTitles) {
      if (fuzzyTitleSimilarity(tk, wtk) > 0.95) return true;
    }
    
    return false;
  });
}

/**
 * Filter chapters to only include recent ones (within last N hours)
 */
export function filterRecentChapters(
  chapters: ChapterItem[],
  cutoffHours: number,
  safeParseDate: (date: string | Date | null | undefined) => Date | null,
  isWithinLastHours: (date: Date, hours: number) => boolean
): ChapterItem[] {
  return chapters.filter(ch => {
    if (!ch.updatedTime) return true; // Allow empty time (like from Ikiru)
    const parsedDate = safeParseDate(ch.updatedTime);
    if (!parsedDate) return false;
    const isRecent = isWithinLastHours(parsedDate, cutoffHours);
    if (!isRecent) {
      logger.debug(
        { title: ch.title, chapter: ch.chapter, updatedTime: ch.updatedTime },
        "filtered out stale chapter"
      );
    }
    return isRecent;
  });
}

/**
 * Sort chapters by time, title, and chapter number
 */
export function sortChapters(
  chapters: ChapterItem[],
  getChapterNumber: (chapter: string) => number | null,
  safeParseDate: (date: string | Date | null | undefined) => Date | null
): ChapterItem[] {
  const enrichedChapters = chapters.map((ch: ChapterItem & { _timeCache?: number; _titleCache?: string; _chapterNum?: number }) => {
    const updatedTime = ch.updatedTime;
    return {
      ...ch,
      _timeCache: updatedTime ? safeParseDate(updatedTime)?.getTime() : NaN,
      _titleCache: String(ch.title || "").toLowerCase(),
      _chapterNum: getChapterNumber(String(ch.chapter || "")) || 0,
    };
  });

  enrichedChapters.sort((a, b) => {
    const ta = a._timeCache;
    const tb = b._timeCache;
    const hasTa = Number.isFinite(ta);
    const hasTb = Number.isFinite(tb);

    if (hasTa !== hasTb) return hasTa ? -1 : 1;
    if (hasTa && hasTb && (ta as number) !== (tb as number)) return (ta as number) - (tb as number);

    if (a._titleCache !== b._titleCache) return a._titleCache.localeCompare(b._titleCache);

    return a._chapterNum - b._chapterNum;
  });

  return enrichedChapters.map(({ _timeCache, _titleCache, _chapterNum, ...item }) => item);
}
