/**
 * Ikiru REST API client
 *
 * Supports two modes:
 * 1. Direct: IKIRU_API = "https://06.ikiru.wtf/wp-json/readerkiru/v1"
 * 2. Proxy:  IKIRU_PROXY_URL = "http://43.133.32.206:8899" + IKIRU_PROXY_TOKEN
 *
 * Proxy mode bypasses Cloudflare blocks from Vercel serverless IPs.
 */

import { getLogger } from "../../logger.js";
import { getIkiruPublicBase } from "../../domain.js";

const logger = getLogger({ scope: "ikiru:api" });

const PROXY_URL = process.env.IKIRU_PROXY_URL || "";
const PROXY_TOKEN = process.env.IKIRU_PROXY_TOKEN || "";
const TIMEOUT_MS = 10_000;

// ─── Types ─────────────────────────────────────────────────────────────

export interface IkiruChapter {
  id: number;
  title: string;
  slug: string;
  number: number;
  permalink: string;
  modified_local: string;
}

export interface IkiruSearchItem {
  id: number;
  title: string;
  slug: string;
  permalink: string;
  cover: string;
  rating: string;
  views: number;
  type: string[];
  genre: string[];
  released: string;
  latest_chapters: IkiruChapter[];
}

export interface IkiruSeries {
  id: number;
  title: string;
  slug: string;
  permalink: string;
  cover: string;
  rating: string;
  views: number;
  type: string[];
  genre: string[];
  released: string;
  description: string;
  latest_chapters: IkiruChapter[];
}

export interface IkiruChapterDetail {
  chapter: { id: number; title: string; number: number };
  prev: { id: number; permalink: string; number: number } | null;
  next: { id: number; permalink: string; number: number } | null;
  total_images: number;
  images: { page: number; url: string }[];
}

export interface IkiruFilter {
  slug: string;
  name: string;
  count: number;
}

// ─── Internal fetch helper ─────────────────────────────────────────────

export async function wpFetch<T>(path: string): Promise<T | null> {
  try {
    const useProxy = PROXY_URL && PROXY_TOKEN;
    const ikiruBase = getIkiruPublicBase();
    const url = useProxy
      ? `${PROXY_URL}/wp-json/wp/v2${path}`
      : `${ikiruBase}/wp-json/wp/v2${path}`;

    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json",
    };
    if (useProxy) {
      headers["Authorization"] = `Bearer ${PROXY_TOKEN}`;
    }

    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err: unknown) {
    logger.warn({ path, err: String(err) }, "WP REST API error");
    return null;
  }
}

async function ikiruFetch<T>(path: string): Promise<T | null> {
  try {
    const useProxy = PROXY_URL && PROXY_TOKEN;
    const ikiruBase = getIkiruPublicBase();
    const url = useProxy
      ? `${PROXY_URL}/wp-json/readerkiru/v1${path}`
      : `${ikiruBase}/wp-json/readerkiru/v1${path}`;

    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
    };
    if (useProxy) {
      headers["Authorization"] = `Bearer ${PROXY_TOKEN}`;
    }

    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.warn({ path, status: res.status }, "Ikiru API non-200");
      return null;
    }
    return (await res.json()) as T;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ path, err: msg }, "Ikiru API fetch failed");
    return null;
  }
}

// ─── Public functions ──────────────────────────────────────────────────

/** Search series by query string */
export async function searchIkiruApi(query: string, perPage = 20): Promise<IkiruSearchItem[]> {
  const q = encodeURIComponent(query);
  const data = await ikiruFetch<{ ok: boolean; items: IkiruSearchItem[] }>(
    `/search/series?q=${q}&per_page=${perPage}`
  );
  return data?.items ?? [];
}

/** Latest updates (24 items, homepage) */
export async function getIkiruLatestUpdates(): Promise<IkiruSearchItem[]> {
  const data = await ikiruFetch<{ ok: boolean; data: IkiruSearchItem[] }>(
    "/home/latest-updates"
  );
  return data?.data ?? [];
}

/** Popular today (12 items) */
export async function getIkiruPopularToday(): Promise<IkiruSearchItem[]> {
  const data = await ikiruFetch<{ ok: boolean; data: IkiruSearchItem[] }>(
    "/home/popular-today"
  );
  return data?.data ?? [];
}

/** Single series detail by slug (NOTE: latest_chapters only — NOT all chapters) */
export async function getIkiruSeries(slug: string): Promise<IkiruSeries | null> {
  // NOTE: /series/{slug} not in proxy ALLOWED_PATHS — use /series/info?slug= instead
  const data = await ikiruFetch<{ ok: boolean; series: IkiruSeries }>(
    `/series/info?slug=${encodeURIComponent(slug)}`
  );
  return data?.series ?? null;
}

/** Chapter images by chapter ID — returns CDN webp URLs */
export async function getIkiruChapterImages(chapterId: number | string): Promise<IkiruChapterDetail | null> {
  const data = await ikiruFetch<{ ok: boolean } & IkiruChapterDetail>(
    `/chapter/${chapterId}`
  );
  if (data) {
    const { ok: _, ...rest } = data;
    return rest;
  }
  // Fallback: extract images from WP REST API content HTML
  return getIkiruChapterImagesFromWpContent(chapterId);
}

/** Fallback: get chapter images from WP REST API content.rendered HTML */
async function getIkiruChapterImagesFromWpContent(wpChapterId: number | string): Promise<IkiruChapterDetail | null> {
  try {
    const data = await wpFetch<any>(
      `/chapter/${wpChapterId}?_fields=id,content`
    );
    if (!data?.content?.rendered) return null;
    const html: string = data.content.rendered;
    const imgs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map(m => m[1]);
    // Dedupe and filter CDN images
    const seen = new Set<string>();
    const urls = imgs.filter(u => u.includes("cdn.itachi.my.id") && !seen.has(u) && seen.add(u));
    if (!urls.length) return null;
    const images = urls.map((url, i) => ({ url, page: i + 1 }));
    return { images } as IkiruChapterDetail;
  } catch {
    return null;
  }
}

/** Fetch full chapter list via WP REST API (bypasses HTML scraper / CF block) */
export async function fetchIkiruChaptersByTitle(title: string): Promise<{ id: number; number: string; title: string; url: string; updatedTime: string | null }[]> {
  // Search WP REST API for chapters matching the manga title
  const perPage = 100;
  let page = 1;
  const all: { id: number; number: string; title: string; url: string; updatedTime: string | null }[] = [];

  while (page <= 10) { // max 1000 chapters
    const data = await wpFetch<any[]>(
      `/chapter?search=${encodeURIComponent(title)}&_fields=id,title,slug,link,modified&per_page=${perPage}&page=${page}`
    );
    if (!data || !Array.isArray(data) || data.length === 0) break;

    for (const c of data) {
      const rawTitle = c.title?.rendered || c.title || "";
      const numMatch = rawTitle.match(/chapter\s+([\d.]+)/i);
      const num = numMatch ? numMatch[1] : "";
      all.push({
        id: c.id,
        number: num,
        title: rawTitle,
        url: c.link || "",
        updatedTime: c.modified || null,
      });
    }
    if (data.length < perPage) break;
    page++;
  }
  return all;
}

/** Types and genres filter lists */
export async function getIkiruFilters(): Promise<{ types: IkiruFilter[]; genres: IkiruFilter[] }> {
  const data = await ikiruFetch<{
    ok: boolean;
    types: IkiruFilter[];
    genres: Record<string, IkiruFilter>;
  }>("/search/filters");
  if (!data) return { types: [], genres: [] };

  // genres come as object with numeric keys → normalize to array
  const genres = data.genres ? Object.values(data.genres) : [];
  return { types: data.types ?? [], genres };
}
