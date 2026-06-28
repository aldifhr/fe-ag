export interface SearchResult {
  id: string;
  title: string;
  cover: string | null;
  url?: string;
  source: string;
  chapter?: string;
  country?: string | null;
  description?: string | null;
  time?: string;
  chapters?: { number: string; time: string | null }[];
  status?: string | number | null;
  rating?: string | number | null;
}

export interface MangaDetail {
  manga: {
    id: string;
    title: string;
    cover: string | null;
    description: string | null;
    status: string | null;
    url: string | null;
    source: string;
    genres: string[];
    user_rate?: number | string | null;
    view_count?: number | null;
    bookmark_count?: number | null;
    release_year?: string | null;
    country_id?: string | null;
    alternative_title?: string | null;
    taxonomy?: Record<string, { name: string; slug?: string }[]>;
  };
  chapters: {
    id: string | number;
    number: string | number;
    title: string;
    url: string;
    createdAt: string | null;
  }[];
}

export interface PageResult {
  images: string[];
  total: number;
  url: string;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function searchManga(
  q: string,
  source = "all",
  sort?: string,
  status?: string,
  signal?: AbortSignal,
  genres?: string,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q, source });
  if (sort) params.set("sort", sort);
  if (status) params.set("status", status);
  if (genres) params.set("genres", genres);
  const data = await fetchJson<{ results: SearchResult[] }>(
    `/api/reader/search?${params.toString()}`,
    signal ? { signal } : undefined,
  );
  return data.results;
}

export async function getMangaDetail(
  id: string,
  source = "shinigami",
): Promise<MangaDetail> {
  const params = `id=${encodeURIComponent(id)}`;
  return fetchJson<MangaDetail>(`/api/reader/manga?source=${source}&${params}`);
}

export async function getChapterPages(
  url: string,
  source?: string,
  chapterId?: string,
  baseUrl?: string,
  chapterNum?: string,
): Promise<PageResult> {
  const params = new URLSearchParams({ url });
  if (source) params.set("source", source);
  if (chapterId) params.set("chapterId", chapterId);
  if (baseUrl) params.set("baseUrl", baseUrl);
  if (chapterNum) params.set("chapter", chapterNum);
  return fetchJson<PageResult>(`/api/reader/pages?${params.toString()}`);
}

export async function getChapterList(
  id: string,
  source = "shinigami",
): Promise<MangaDetail["chapters"]> {
  const detail = await getMangaDetail(id, source);
  return detail.chapters;
}

export async function getLatest(
  source = "all",
  page = 1,
  sort = "latest",
): Promise<SearchResult[]> {
  const data = await fetchJson<{ results: SearchResult[] }>(
    `/api/reader/latest?source=${source}&page=${page}&sort=${sort}`,
  );
  return data.results;
}

export interface Genre {
  taxonomy_id: number;
  slug: string;
  name: string;
  type: string;
}

export async function getGenres(): Promise<Genre[]> {
  const data = await fetchJson<{ genres: Genre[] }>(`/api/reader/genres`);
  return data.genres;
}

export async function getGenreManga(
  slug: string,
  page = 1,
): Promise<SearchResult[]> {
  const data = await fetchJson<{ results: SearchResult[] }>(
    `/api/reader/genre-manga?genre=${encodeURIComponent(slug)}&page=${page}&page_size=20`,
  );
  return data.results;
}

export async function getRandomManga(): Promise<SearchResult> {
  const data = await fetchJson<{ result: SearchResult }>("/api/reader/random");
  return data.result;
}

export async function getPopularToday(): Promise<SearchResult[]> {
  const data = await fetchJson<{ results: SearchResult[] }>(
    "/api/reader/popular",
  );
  return data.results;
}

// ─── Clerk User API ─────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  role: string;
}

export async function getMe(): Promise<UserProfile | null> {
  try {
    const res = await fetch("/api/me");
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.success) return null;
    return json.data;
  } catch {
    return null;
  }
}

// ─── Favorites API ──────────────────────────────────────────────

export interface FavoriteItem {
  manga_id: string;
  manga_title: string;
  manga_cover: string;
  manga_source: string;
  manga_url: string;
  created_at: string;
}

export async function getFavoritesApi(): Promise<FavoriteItem[]> {
  const res = await fetch("/api/favorites");
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || "Failed to fetch favorites");
  return json.data;
}

export async function addFavoriteApi(fields: {
  id: string;
  title: string;
  cover: string;
  source: string;
  url?: string;
}): Promise<boolean> {
  const res = await fetch("/api/favorites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: fields.id,
      title: fields.title,
      cover: fields.cover,
      source: fields.source,
      url: fields.url ?? "",
    }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || "Failed to add favorite");
  return json.data.added;
}

export async function removeFavoriteApi(id: string): Promise<boolean> {
  const res = await fetch(`/api/favorites?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || "Failed to remove favorite");
  return json.data.removed;
}

export async function isFavoriteApi(id: string): Promise<boolean> {
  try {
    const res = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, _action: "check" }),
    });
    const json = await res.json();
    if (!json.success) return false;
    return json.data.favorited;
  } catch {
    return false;
  }
}

// ─── User History API ───────────────────────────────────────────

export interface HistoryItem {
  manga_id: string;
  manga_title: string;
  manga_cover: string;
  manga_source: string;
  manga_url: string;
  chapter: string;
  last_read: string;
}

export async function getHistoryApi(limit = 50): Promise<HistoryItem[]> {
  const res = await fetch(`/api/user-history?limit=${limit}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || "Failed to fetch history");
  return json.data;
}

export async function addHistoryApi(fields: {
  id: string;
  title: string;
  cover: string;
  source: string;
  url?: string;
  chapter: string;
}): Promise<boolean> {
  const res = await fetch("/api/user-history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || "Failed to save history");
  return json.data.saved;
}

export async function clearHistoryApi(): Promise<boolean> {
  const res = await fetch("/api/user-history", { method: "DELETE" });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || "Failed to clear history");
  return json.data.cleared;
}

/** Proxy images from domains that block hotlinking or benefit from WebP conversion */
function proxyUrl(url: string | null | undefined, requireHttp?: boolean): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (requireHttp && !["http:", "https:"].includes(parsed.protocol)) return url;
    // Proxy all external images — avoids CORS/referrer issues from localhost
    // and enables WebP conversion for CDN images
    return `/api/reader/image?src=${encodeURIComponent(url)}`;
  } catch {
    return url;
  }
}

/** Proxy cover images from domains that block hotlinking */
export function proxyCover(url: string | null): string {
  return proxyUrl(url);
}

/** Proxy images from domains that block hotlinking or benefit from WebP conversion */
export function proxyImage(url: string | null | undefined): string {
  return proxyUrl(url, true);
}
