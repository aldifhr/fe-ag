export interface SearchResult {
  id: string;
  title: string;
  cover: string | null;
  url?: string;
  source: string;
  chapter?: string;
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

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function searchManga(q: string, source = "all", sort?: string, status?: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q, source });
  if (sort) params.set("sort", sort);
  if (status) params.set("status", status);
  const data = await fetchJson<{ results: SearchResult[] }>(`/api/reader/search?${params.toString()}`);
  return data.results;
}

export async function getMangaDetail(id: string, source = "shinigami"): Promise<MangaDetail> {
  const params = `id=${encodeURIComponent(id)}`;
  return fetchJson<MangaDetail>(`/api/reader/manga?source=${source}&${params}`);
}

export async function getChapterPages(url: string, source?: string, chapterId?: string, baseUrl?: string, chapterNum?: string): Promise<PageResult> {
  const params = new URLSearchParams({ url });
  if (source) params.set("source", source);
  if (chapterId) params.set("chapterId", chapterId);
  if (baseUrl) params.set("baseUrl", baseUrl);
  if (chapterNum) params.set("chapter", chapterNum);
  return fetchJson<PageResult>(`/api/reader/pages?${params.toString()}`);
}

export async function getChapterList(id: string, source = "shinigami"): Promise<MangaDetail["chapters"]> {
  const detail = await getMangaDetail(id, source);
  return detail.chapters;
}

export async function getLatest(source = "all", page = 1, sort = "latest"): Promise<SearchResult[]> {
  const data = await fetchJson<{ results: SearchResult[] }>(`/api/reader/latest?source=${source}&page=${page}&sort=${sort}`);
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

export async function getGenreManga(slug: string, page = 1): Promise<SearchResult[]> {
  const data = await fetchJson<{ results: SearchResult[] }>(
    `/api/reader/genre-manga?genre=${encodeURIComponent(slug)}&page=${page}&page_size=20`
  );
  return data.results;
}

export async function getRandomManga(): Promise<SearchResult> {
  const data = await fetchJson<{ result: SearchResult }>("/api/reader/random");
  return data.result;
}

export interface FilterType {
  slug: string;
  name: string;
  count: number;
}

export interface FilterGenre {
  slug: string;
  name: string;
  count: number;
}

export interface FiltersResult {
  types: FilterType[];
  genres: FilterGenre[];
}

export async function getPopularToday(): Promise<SearchResult[]> {
  const data = await fetchJson<{ results: SearchResult[] }>("/api/reader/popular");
  return data.results;
}

export async function getFilters(): Promise<FiltersResult> {
  return fetchJson<FiltersResult>("/api/reader/filters");
}

/** Proxy cover images from domains that block hotlinking */
export function proxyCover(url: string | null): string {
  if (!url) return "";
  try {
    const hostname = new URL(url).hostname;
    const needsProxy = ["06.ikiru.wtf", "03.ikiru.wtf"].includes(hostname);
    return needsProxy ? `/api/reader/image?src=${encodeURIComponent(url)}` : url;
  } catch {
    return url;
  }
}
