/**
 * Ikiru REST API client — replaces Python Scrapling bridge for all operations
 * except full chapter list expansion (which still needs Scrapling).
 *
 * API base: https://06.ikiru.wtf/wp-json/readerkiru/v1
 */

import { getLogger } from "../../logger.js";

const logger = getLogger({ scope: "ikiru:api" });

const IKIRU_API = "https://06.ikiru.wtf/wp-json/readerkiru/v1";
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

async function ikiruFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${IKIRU_API}${path}`, {
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
  const data = await ikiruFetch<{ ok: boolean; series: IkiruSeries }>(
    `/series/${encodeURIComponent(slug)}`
  );
  return data?.series ?? null;
}

/** Chapter images by chapter ID — returns CDN webp URLs */
export async function getIkiruChapterImages(chapterId: number | string): Promise<IkiruChapterDetail | null> {
  const data = await ikiruFetch<{ ok: boolean } & IkiruChapterDetail>(
    `/chapter/${chapterId}`
  );
  if (!data) return null;
  const { ok: _, ...rest } = data;
  return rest;
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
