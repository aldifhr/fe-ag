import { SECONDARY_SOURCE_URL } from "../../shared/scrapers/shared.js";
import { SECONDARY_CONFIG } from "../../reader/config.js";
import { fetchWithRetry, JSON_HEADERS } from "../../shared/scrapers/secondary/api.js";
import { isAxiosLikeResponse, isSecondaryApiData } from "../../shared/scrapers/secondary/types.js";
import { getIkiruPopularToday, getIkiruFilters } from "../../shared/scrapers/ikiru/api.js";
import { pickCover } from "./helpers.js";
import type { Request, Response } from "express";

// ─── Popular (Ikiru) ─────────────────────────────────────────────────

export async function handlePopular(_req: Request, res: Response) {
  try {
    const items = await getIkiruPopularToday();
    const results = items.map(item => ({
      id: String(item.id),
      title: item.title,
      cover: item.cover || null,
      url: item.permalink,
      source: "ikiru",
      chapter: item.latest_chapters?.[0] ? String(item.latest_chapters[0].number) : "",
      time: item.latest_chapters?.[0]?.modified_local || null,
    }));
    return res.json({ results, total: results.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.json({ results: [], total: 0, error: message });
  }
}

// ─── Filters (Ikiru) ─────────────────────────────────────────────────

export async function handleFilters(_req: Request, res: Response) {
  try {
    const filters = await getIkiruFilters();
    return res.json(filters);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.json({ types: [], genres: [], error: message });
  }
}

// ─── Genres ──────────────────────────────────────────────────────────

export async function handleGenres(req: Request, res: Response) {
  try {
    const endpoint = `${SECONDARY_SOURCE_URL}/v1/genre/list`;
    const apiRes = await fetchWithRetry(endpoint, JSON_HEADERS, SECONDARY_CONFIG.REQUEST_TIMEOUT);

    if (!isAxiosLikeResponse(apiRes)) {
      return res.status(502).json({ error: "Failed to fetch genres from Shinigami API" });
    }

    const payload = (apiRes.data as any)?.data ?? [];
    return res.json({ genres: payload });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}

export async function handleGenreManga(req: Request, res: Response) {
  try {
    const genre = req.query.genre as string;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.page_size as string) || 20;
    const sort = (req.query.sort as string) || "latest";

    if (!genre) {
      return res.status(400).json({ error: "Query parameter 'genre' (slug) required" });
    }

    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
      genre_include: genre,
      genre_include_mode: "and",
      sort,
    });

    const endpoint = `${SECONDARY_SOURCE_URL}/v1/manga/list?${params}`;
    const apiRes = await fetchWithRetry(endpoint, JSON_HEADERS, SECONDARY_CONFIG.REQUEST_TIMEOUT);

    if (!isAxiosLikeResponse(apiRes)) {
      return res.status(502).json({ error: "Failed to fetch genre manga from Shinigami API" });
    }

    const raw = (apiRes.data as any)?.data ?? [];
    const results = raw.map((item: any) => ({
      id: String(item.manga_id ?? item.id ?? ""),
      title: item.title || "Unknown",
      cover: pickCover(item),
      source: "shinigami",
      chapter: String(item.latest_chapter_number ?? ""),
      time: item.latest_chapter_time || item.updated_at || undefined,
    }));

    return res.json({ results, total: (apiRes.data as any)?.total ?? results.length, page, pageSize });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}

// ─── Random ──────────────────────────────────────────────────────────

export async function handleRandom(_req: Request, res: Response) {
  const randomPage = Math.floor(Math.random() * 50) + 1;
  const params = new URLSearchParams({ page: String(randomPage), page_size: "1", sort: "latest" });
  const endpoint = `${SECONDARY_SOURCE_URL}/v1/manga/list?${params}`;
  const apiRes = await fetchWithRetry(endpoint, JSON_HEADERS, SECONDARY_CONFIG.REQUEST_TIMEOUT);

  if (!isAxiosLikeResponse(apiRes)) {
    return res.status(502).json({ error: "Failed to fetch random manga" });
  }

  const raw = ((apiRes.data as any)?.data ?? []) as any[];
  if (!raw.length) {
    return res.status(404).json({ error: "No manga found" });
  }

  const row = raw[0];
  const result = {
    id: String(row.manga_id ?? row.id ?? ""),
    title: row.title || "Unknown",
    cover: pickCover(row),
    source: "shinigami",
    chapter: String(row.latest_chapter_number ?? ""),
    time: row.latest_chapter_time || row.updated_at || undefined,
  };

  return res.json({ result });
}

// ─── Health ──────────────────────────────────────────────────────────

export async function handleHealth(_req: Request, res: Response) {
  let shinigami: "ok" | "error" = "error";
  try {
    const endpoint = `${SECONDARY_SOURCE_URL}/v1/manga/list?page=1&page_size=1`;
    const apiRes = await fetchWithRetry(endpoint, JSON_HEADERS, 8000);
    shinigami = isAxiosLikeResponse(apiRes) ? "ok" : "error";
  } catch {
    shinigami = "error";
  }
  return res.json({ shinigami, timestamp: Date.now() });
}

// ─── Debug ───────────────────────────────────────────────────────────

export async function handleDebug(req: Request, res: Response) {
  const mangaId = req.query.id as string || "1";
  const endpoint = `${SECONDARY_SOURCE_URL}/v1/manga/detail/${mangaId}`;

  const apiRes = await fetchWithRetry(endpoint, JSON_HEADERS, SECONDARY_CONFIG.REQUEST_TIMEOUT);

  if (!isAxiosLikeResponse(apiRes)) {
    return res.json({ error: "Not an Axios-like response", data: null });
  }

  const raw = isSecondaryApiData(apiRes.data) ? apiRes.data : {};
  const rawData = raw as Record<string, unknown>;
  const payload = rawData.data ?? raw;

  const chapterKeys = ["chapters", "latest_chapters", "chapter_list", "chapterList"];
  const foundChapters: Record<string, unknown> = {};

  for (const key of chapterKeys) {
    const val = (payload as Record<string, unknown>)[key];
    if (Array.isArray(val)) {
      foundChapters[key] = { count: val.length, first: val[0] ? Object.keys(val[0] as Record<string, unknown>) : null, sample: val[0] ? (val[0] as Record<string, unknown>) : null };
    } else {
      foundChapters[key] = typeof val;
    }
  }

  for (const key of chapterKeys) {
    const val = (raw as Record<string, unknown>)[key];
    if (Array.isArray(val)) {
      foundChapters[`raw.${key}`] = { count: val.length, first: val[0] ? Object.keys(val[0] as Record<string, unknown>) : null };
    } else {
      foundChapters[`raw.${key}`] = typeof val;
    }
  }

  const nested = (raw as Record<string, unknown>).data as Record<string, unknown> | undefined;
  if (nested) {
    for (const key of chapterKeys) {
      const val = nested[key];
      if (Array.isArray(val)) {
        foundChapters[`nested.${key}`] = { count: val.length, first: val[0] ? Object.keys(val[0] as Record<string, unknown>) : null };
      } else {
        foundChapters[`nested.${key}`] = typeof val;
      }
    }
  }

  return res.json({
    endpoint,
    isAxiosLike: true,
    isSecondaryApiData: isSecondaryApiData(apiRes.data),
    rawType: typeof apiRes.data,
    rawKeys: apiRes.data && typeof apiRes.data === "object" ? Object.keys(apiRes.data as Record<string, unknown>) : null,
    payloadType: typeof payload,
    payloadKeys: payload && typeof payload === "object" ? Object.keys(payload as Record<string, unknown>) : null,
    chapters: foundChapters,
    title: (payload as Record<string, unknown>)?.title,
    cover: (payload as Record<string, unknown>)?.cover_portrait_url,
  });
}
