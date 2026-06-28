import { SECONDARY_SOURCE_URL } from "../../shared/scrapers/shared.js";
import { SECONDARY_CONFIG } from "../../reader/config.js";
import { fetchWithRetry, JSON_HEADERS, fetchUpdateList } from "../../shared/scrapers/secondary/api.js";
import { isAxiosLikeResponse } from "../../shared/scrapers/secondary/types.js";
import { scrapeIkiruUpdatesWithMeta } from "../../shared/scrapers/ikiru/index.js";
import { getIkiruPopularToday } from "../../shared/scrapers/ikiru/api.js";
import type { Request, Response } from "express";

// ─── Types ──────────────────────────────────────────────────────────

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
          cover: row.cover_portrait_url || row.cover_image_url || row.cover || null,
          url: row.direct_series_url || null,
          source: "shinigami",
          chapter: String(row.latest_chapter_number ?? ""),
          time: row.latest_chapter_time || row.updated_at || undefined,
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
            cover: row.cover_portrait_url || row.cover_image_url || row.cover || null,
            url: row.direct_series_url || null,
            source: "shinigami",
            chapter: String(row.latest_chapter_number ?? ""),
            time: row.latest_chapter_time || row.updated_at || undefined,
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
        });
      }
    }
    return items;
  })() : Promise.resolve<LatestResultItem[]>([]);

  const [shinigamiItems, ikiruItems] = await Promise.all([shinigamiPromise, ikiruPromise]);
  const all: LatestResultItem[] = [...shinigamiItems, ...ikiruItems];

  const total = all.length;
  // For popularity/rating the API already paginated; for latest we slice client-side
  const results = sort === "latest" ? all.slice((page - 1) * PAGE_SIZE, (page - 1) * PAGE_SIZE + PAGE_SIZE) : all;

  return res.json({ results, total, page, pageSize: PAGE_SIZE });
}
