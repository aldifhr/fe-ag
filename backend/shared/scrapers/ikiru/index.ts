import { parseDateWithFallback, parseLooseRelativeTime } from "../../dateUtils.js";
import { IKIRU_CONFIG } from "../../../lib/config.js";
import { ChapterItem, ScraperMetrics, SourceState, ScraperProvider } from "../../types.js";

import { getLogger } from "../../logger.js";
import { fetchIkiruLatest, fetchIkiruMangaDetail } from "./scraper.js";
import {
  searchIkiruApi,
  getIkiruSeries,
} from "./api.js";
import type { IkiruSearchItem } from "./api.js";

const logger = getLogger({ scope: "ikiru:scraper" });

// --- Helper: extract slug from any Ikiru URL ---

function extractSlugFromUrl(url: string): string | null {
  // Matches /manga/{slug}/ or /manga/{slug} across any domain
  const m = url.match(/\/manga\/([^/]+)/);
  return m?.[1] ?? null;
}

// --- Scraper Logic ---

export async function fetchIkiruMetadata(mangaUrl: string) {
  try {
    const slug = extractSlugFromUrl(mangaUrl);
    if (!slug) {
      logger.warn({ url: mangaUrl }, "Cannot extract slug from URL");
      return null;
    }

    const series = await getIkiruSeries(slug);
    if (!series) return null;

    return {
      title: series.title || undefined,
      description: series.description || undefined,
      genres: series.genre || [],
      status: undefined,
      rating: series.rating || undefined,
      cover: series.cover || undefined,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ url: mangaUrl, err: message }, "Failed to fetch Ikiru metadata via REST API");
    return null;
  }
}

export async function scrapeIkiruUpdatesWithMeta(
  preferredIkiru: { titles: Set<string | null>; urls: Set<string | null> } | Set<string | null> = new Set(),
  loggerParam: any = null,
  options: { skipExpansion?: boolean; maxPages?: number } = {},
): Promise<{ results: ChapterItem[]; state: SourceState }> {
  const sourceState: SourceState = {
    status: "pending",
    count: 0,
    error: null,
    metrics: null,
  };

  const maxPages = options.maxPages ?? IKIRU_CONFIG.MAX_PAGES ?? 1;

  let rawItems: Awaited<ReturnType<typeof fetchIkiruLatest>> = [];
  try {
    rawItems = await fetchIkiruLatest(maxPages);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "[scrapeIkiruUpdatesWithMeta] Cheerio scraper failed");
  }

  const results: ChapterItem[] = (Array.isArray(rawItems) ? rawItems : []).map((item) => ({
    title: item.title || "",
    chapter: item.chapter || "",
    url: item.url || "",
    mangaUrl: item.mangaUrl || "",
    source: "ikiru" as const,
    updatedTime: item.updatedTime
      ? (parseDateWithFallback(item.updatedTime) || parseLooseRelativeTime(item.updatedTime))?.toISOString() ?? item.updatedTime
      : null,
    cover: item.cover || null,
    rating: item.rating || null,
    genres: item.genres || [],
  }));

  sourceState.status = results.length > 0 ? "ok" : "empty";
  sourceState.count = results.length;
  sourceState.metrics = {
    pagesScanned: maxPages,
    stalePageStreak: 0,
    emptyPageStreak: results.length === 0 ? 1 : 0,
    maxPages,
    preferredTitles: 0,
    preferredUrls: 0,
    expandedCount: 0,
    expansionSkipped: true,
  } as ScraperMetrics;

  return { results, state: sourceState };
}

export async function searchIkiru(
  query: string,
  options: Record<string, unknown> = {},
): Promise<{ success: boolean; data: ChapterItem[] }> {
  const keyword = String(query ?? "").trim();
  if (!keyword) return { success: true, data: [] };

  try {
    const items = await searchIkiruApi(keyword);

    const results: ChapterItem[] = items.map((item: IkiruSearchItem) => {
      const latest = item.latest_chapters?.[0];
      return {
        title: item.title || "",
        chapter: latest ? String(latest.number) : "",
        url: latest?.permalink || item.permalink,  // Use chapter permalink for dispatch key
        mangaUrl: item.permalink,
        source: "ikiru",
        updatedTime: latest?.modified_local
          ? (parseDateWithFallback(latest.modified_local) || parseLooseRelativeTime(latest.modified_local))?.toISOString() ?? latest.modified_local
          : null,
        cover: item.cover || null,
        rating: item.rating || null,
        genres: item.genre || [],
      };
    });

    return { success: true, data: results };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error({ query, err: error.message }, "[searchIkiru] REST API failed");
    return { success: false, data: [] };
  }
}

// Cheerio HTML scraper for full chapter list (REST API only returns latest_chapters)
export async function fetchIkiruChapters(mangaUrl: string): Promise<ChapterItem[]> {
  try {
    const { chapters } = await fetchIkiruMangaDetail(mangaUrl, true);

    return chapters.map(item => ({
      ...item,
      description: item.description || null,
      updatedTime: item.updatedTime ? (parseDateWithFallback(item.updatedTime) || parseLooseRelativeTime(item.updatedTime))?.toISOString() : null
    }));
  } catch (err: unknown) {
    logger.error({ mangaUrl, err: String(err) }, "[fetchIkiruChapters] Cheerio scraper failed");
    return [];
  }
}

// --- Provider Implementation ---

export const IkiruProvider: ScraperProvider = {
  name: "ikiru",

  async scrapeLatest(options: any) {
    return scrapeIkiruUpdatesWithMeta(
      options.preferred,
      logger as any,
      options
    );
  },

  async search(query: string, options: any = {}) {
    return searchIkiru(query, options);
  },

  async fetchMetadata(mangaUrl: string, _options: any = {}) {
    return fetchIkiruMetadata(mangaUrl);
  }
};
