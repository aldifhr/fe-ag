import { SECONDARY_SOURCE_URL } from "../../shared/scrapers/shared.js";
import { SECONDARY_CONFIG } from "../../reader/config.js";
import { fetchWithRetry, JSON_HEADERS, fetchUpdateList } from "../../shared/scrapers/secondary/api.js";
import { isAxiosLikeResponse } from "../../shared/scrapers/secondary/types.js";
import { scrapeIkiruUpdatesWithMeta } from "../../shared/scrapers/ikiru/index.js";
import { getIkiruPopularToday } from "../../shared/scrapers/ikiru/api.js";
import { pickCover, pickTime } from "./helpers.js";
import type { Request, Response } from "express";

// ─── Types ──────────────────────────────────────────────────────────

/** Extract numeric value from chapter string: "Chapter 285" → "285", "285" → "285" */
function normChapter(ch: string): string {
  return ch.replace(/^chapter\s+/i, "").replace(/^ch\.?\s*/i, "").trim();
}

interface LatestResultItem {
  id: string;
  title: string;
  cover: string | null;
  url: string | null;
  source: string;
  chapter?: string;
  time?: string;
  status?: string | number | null;
  rating?: string | number | null;
  chapters?: { number: string; time: string | null }[];
}

/**
 * Group items by manga ID, merging multiple chapters into a `chapters` array.
 * Each manga appears once with the latest chapter as primary.
 * Status/rating always come from the highest-numbered chapter entry.
 */
function deduplicateByManga(items: LatestResultItem[]): LatestResultItem[] {
  const byId = new Map<string, LatestResultItem & { _chapterNums: number[] }>();
  for (const item of items) {
    const key = `${item.source}:${item.id}`;
    const chNum = parseFloat(item.chapter || "0") || 0;
    const existing = byId.get(key);
    if (!existing) {
      const entry: any = {
        ...item,
        chapter: item.chapter ? normChapter(item.chapter) : item.chapter,
        chapters: item.chapter
          ? [{ number: normChapter(item.chapter), time: item.time ?? null }]
          : [],
      };
      entry._chapterNums = [chNum];
      byId.set(key, entry);
      continue;
    }
    // Merge chapter (normalize + dedupe by numeric value)
    if (item.chapter) {
      const num = normChapter(item.chapter);
      const numVal = parseFloat(num) || 0;
      const isDupe = existing.chapters!.some((c) => {
        const existingNum = parseFloat(c.number) || 0;
        return existingNum === numVal && numVal !== 0;
      });
      if (!isDupe) {
        existing.chapters!.push({ number: num, time: item.time ?? null });
        existing._chapterNums.push(chNum);
      }
    }
    // Promote to primary if this chapter is higher
    if (chNum > Math.max(...existing._chapterNums.filter((n: number) => n !== chNum), 0)) {
      existing.chapter = normChapter(item.chapter || "");
      existing.time = item.time ?? existing.time;
      existing.status = item.status ?? existing.status;
      existing.rating = item.rating ?? existing.rating;
    }
  }
  // Finalize: sort chapters desc, sync primary with highest
  for (const item of byId.values()) {
    if (item.chapters && item.chapters.length > 1) {
      item.chapters.sort((a, b) => (parseFloat(b.number) || 0) - (parseFloat(a.number) || 0));
      item.chapter = item.chapters[0].number;
      item.time = item.chapters[0].time ?? item.time;
    }
    delete (item as any)._chapterNums;
  }
  return [...byId.values()];
}

/** Normalize title for cross-source matching: lowercase, trim, collapse whitespace */
function normTitle(t: string): string {
  return t.toLowerCase().replace(/[\s_]+/g, " ").trim();
}

/**
 * Cross-source dedup: when Shinigami and Ikiru both have the same manga
 * (e.g. both updated within 24h), keep one card with merged chapters from both.
 * Prefers whichever source has the higher chapter number.
 */
function deduplicateCrossSource(items: LatestResultItem[]): LatestResultItem[] {
  const byTitle = new Map<string, LatestResultItem & { _chapterNums: number[] }>();
  for (const item of items) {
    const titleKey = normTitle(item.title);
    const chNum = parseFloat(item.chapter || "0") || 0;
    const existing = byTitle.get(titleKey);
    if (!existing) {
      const entry: any = {
        ...item,
        chapter: item.chapter ? normChapter(item.chapter) : item.chapter,
      };
      entry._chapterNums = [chNum];
      byTitle.set(titleKey, entry);
      continue;
    }
    // Merge chapters from second source (normalize + dedupe)
    if (item.chapter) {
      if (!existing.chapters) existing.chapters = [];
      const num = normChapter(item.chapter);
      const numVal = parseFloat(num) || 0;
      const isDupe = existing.chapters.some((c) => {
        const existingNum = parseFloat(c.number) || 0;
        return existingNum === numVal && numVal !== 0;
      });
      if (!isDupe) {
        existing.chapters.push({ number: num, time: item.time ?? null });
        existing._chapterNums.push(chNum);
      }
    }
    // Prefer source with higher chapter number
    if (chNum > Math.max(...existing._chapterNums.filter((n: number) => n !== chNum), 0)) {
      existing.source = item.source;
      existing.id = item.id;
      existing.url = item.url;
      existing.chapter = normChapter(item.chapter || "");
      existing.time = item.time ?? existing.time;
      existing.status = item.status ?? existing.status;
      existing.rating = item.rating ?? existing.rating;
    }
    // Prefer non-null cover
    if (!existing.cover && item.cover) {
      existing.cover = item.cover;
    }
  }
  // Finalize
  for (const item of byTitle.values()) {
    if (item.chapters && item.chapters.length > 1) {
      item.chapters.sort((a, b) => (parseFloat(b.number) || 0) - (parseFloat(a.number) || 0));
      item.chapter = item.chapters[0].number;
      item.time = item.chapters[0].time ?? item.time;
    }
    delete (item as any)._chapterNums;
  }
  return [...byTitle.values()];
}

// ─── Handler ────────────────────────────────────────────────────────

export async function handleLatest(req: Request, res: Response) {
  const page = parseInt(req.query.page as string) || 1;
  const source = (req.query.source as string) || "all";
  const sort = (req.query.sort as string) || "latest";

  const PAGE_SIZE = 50;

  // B1: Fetch Shinigami and Ikiru in parallel when source="all"
  const shinigamiPromise = (source === "all" || source === "shinigami") ? (async (): Promise<LatestResultItem[]> => {
    const items: LatestResultItem[] = [];
    if (sort === "latest") {
      const rows = await fetchUpdateList(SECONDARY_SOURCE_URL, undefined);
      for (const row of rows) {
        items.push({
          id: String(row.manga_id),
          title: row.title || "Unknown",
          cover: pickCover(row),
          url: row.direct_series_url || null,
          source: "shinigami",
          chapter: String(row.latest_chapter_number ?? ""),
          time: pickTime(row),
          status: row.status ?? null,
          rating: row.user_rate ?? null,
          chapters: (row as any).chapters?.slice(0, 2).map((c: any) => ({ number: String(c.chapter_number), time: c.created_at ?? null })),
        });
      }
    } else {
      // popularity / rating — use /v1/manga/list with sort param (no is_update filter)
      const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE), sort });
      const endpoint = `${SECONDARY_SOURCE_URL}/v1/manga/list?${params}`;
      const apiRes = await fetchWithRetry(endpoint, JSON_HEADERS, SECONDARY_CONFIG.REQUEST_TIMEOUT);
      if (isAxiosLikeResponse(apiRes)) {
        const raw = ((apiRes as any).data?.data ?? []) as any[];
        for (const row of raw) {
          items.push({
            id: String(row.manga_id ?? row.id ?? ""),
            title: row.title || "Unknown",
            cover: pickCover(row),
            url: row.direct_series_url || null,
            source: "shinigami",
            chapter: String(row.latest_chapter_number ?? ""),
            time: pickTime(row),
            status: row.status ?? null,
            rating: row.user_rate ?? null,
            chapters: row.chapters?.slice(0, 2).map((c: any) => ({ number: String(c.chapter_number), time: c.created_at ?? null })),
          });
        }
      }
    }
    return items;
  })() : Promise.resolve<LatestResultItem[]>([]);

  const ikiruPromise = (source === "all" || source === "ikiru") ? (async (): Promise<LatestResultItem[]> => {
    const items: LatestResultItem[] = [];
    if (sort === "popularity") {
      const popularItems = await getIkiruPopularToday();
      for (const item of popularItems) {
        const mangaUrl = item.permalink;
        const slug = mangaUrl?.match(/\/manga\/([^/]+)/)?.[1] || "";
        const latest = item.latest_chapters?.[0];
        items.push({
          id: slug || mangaUrl || "",
          title: item.title,
          cover: item.cover ?? null,
          url: mangaUrl,
          source: "ikiru",
          chapter: latest ? String(latest.number) : "",
          time: latest?.modified_local || undefined,
          rating: item.rating ?? null,
        });
      }
    } else {
      const ikiruRes = await scrapeIkiruUpdatesWithMeta();
      const ikiruItems = ikiruRes.results || [];
      for (const item of ikiruItems) {
        const mangaUrl = item.mangaUrl ?? item.url;
        const slug = mangaUrl?.match(/\/manga\/([^/]+)/)?.[1] || "";
        items.push({
          id: slug || mangaUrl || "",
          title: item.title,
          cover: item.cover ?? null,
          url: mangaUrl,
          source: "ikiru",
          chapter: item.chapter,
          time: item.updatedTime || undefined,
          rating: item.rating ?? null,
          status: item.status ?? null,
        });
      }
    }
    return items;
  })() : Promise.resolve<LatestResultItem[]>([]);

  const [rawShinigami, rawIkiru] = await Promise.all([shinigamiPromise, ikiruPromise]);
  // Within-source dedup: group by manga ID, merge chapters
  const shinigamiItems = deduplicateByManga(rawShinigami);
  const ikiruItems = deduplicateByManga(rawIkiru);
  // Interleave: Shinigami×2 + Ikiru×1 so both sources appear on page 1
  const all: LatestResultItem[] = [];
  let si = 0, ik = 0;
  while (si < shinigamiItems.length || ik < ikiruItems.length) {
    if (si < shinigamiItems.length) all.push(shinigamiItems[si++]);
    if (si < shinigamiItems.length) all.push(shinigamiItems[si++]);
    if (ik < ikiruItems.length) all.push(ikiruItems[ik++]);
  }
  // Cross-source dedup: merge same-title manga from Shinigami + Ikiru
  const deduped = deduplicateCrossSource(all);
  const total = deduped.length;
  const results = sort === "latest"
    ? deduped.slice((page - 1) * PAGE_SIZE, (page - 1) * PAGE_SIZE + PAGE_SIZE)
    : deduped;

  return res.json({ results, total, page, pageSize: PAGE_SIZE });
}
