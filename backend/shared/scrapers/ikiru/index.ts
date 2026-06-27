import {
  SITE_URL,
  classifyScraperError,
} from "../shared.js";
import { parseDateWithFallback, parseLooseRelativeTime } from "../../dateUtils.js";
import { IKIRU_CONFIG } from "../../../lib/config.js";
import { ChapterItem, ScraperMetrics, SourceState, ScraperProvider } from "../../types.js";

import { getLogger } from "../../logger.js";
import { runScrapling } from "../../utils/scrapling-bridge.js";
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
  _preferredIkiru: { titles: Set<string | null>; urls: Set<string | null> } | Set<string | null> = new Set(),
  _logger: any = null,
  _options: { skipExpansion?: boolean; maxPages?: number } = {},
) {
  // REST API (06.ikiru.wtf) returns 403 from Vercel — use Scrapling directly
  // Scrapling bridge (Python HTML scraper) was the original working approach for cron
  return scrapeIkiruWithScrapling(_preferredIkiru, _logger, _options);
}

export async function searchIkiru(
  query: string,
  _options: Record<string, unknown> = {},
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

// KEEP using Scrapling: REST API only returns latest_chapters, not full chapter list
export async function fetchIkiruChapters(mangaUrl: string): Promise<ChapterItem[]> {
  try {
    const rawResults = await runScrapling<any[]>({
      action: "expand",
      url: mangaUrl,
      baseUrl: SITE_URL,
      skipMeta: false
    });

    return rawResults.map(item => ({
      ...item,
      description: item.description || item.synopsis || null,
      updatedTime: item.updatedTime ? (parseDateWithFallback(item.updatedTime) || parseLooseRelativeTime(item.updatedTime))?.toISOString() : null
    }));
  } catch (err: unknown) {
    logger.error({ mangaUrl, err: String(err) }, "[fetchIkiruChapters] Scrapling failed");
    return [];
  }
}

// --- Scrapling Fallback (for when REST API is blocked) ---

async function scrapeIkiruWithScrapling(
  _preferredIkiru: { titles: Set<string | null>; urls: Set<string | null> } | Set<string | null> = new Set(),
  _logger: any = null,
  _options: { skipExpansion?: boolean; maxPages?: number } = {},
): Promise<{ results: ChapterItem[]; state: SourceState }> {
  const sourceState: SourceState = {
    status: "pending",
    count: 0,
    error: null,
    metrics: null,
  };

  const rawResults = await runScrapling<any[]>({
    action: "latest",
    baseUrl: SITE_URL,
    maxPages: _options.maxPages ?? 1,
  });

  const results: ChapterItem[] = rawResults.map((item) => ({
    title: item.title || "",
    chapter: item.chapter || item.number || "",
    url: item.url || item.mangaUrl || "",
    mangaUrl: item.mangaUrl || item.url || "",
    source: "ikiru",
    updatedTime: item.updatedTime
      ? (parseDateWithFallback(item.updatedTime) || parseLooseRelativeTime(item.updatedTime))?.toISOString() ?? item.updatedTime
      : null,
    cover: item.cover || item.image || null,
    rating: item.rating || null,
    genres: item.genres || [],
  }));

  sourceState.status = results.length > 0 ? "ok" : "empty";
  sourceState.count = results.length;
  sourceState.metrics = {
    pagesScanned: 1,
    stalePageStreak: 0,
    emptyPageStreak: results.length === 0 ? 1 : 0,
    maxPages: _options.maxPages ?? 1,
    preferredTitles: 0,
    preferredUrls: 0,
    expandedCount: 0,
    expansionSkipped: true,
  } as ScraperMetrics;

  return { results, state: sourceState };
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
    return searchIkiru(query, {});
  },

  async fetchMetadata(mangaUrl: string, _options: any = {}) {
    return fetchIkiruMetadata(mangaUrl);
  }
};
