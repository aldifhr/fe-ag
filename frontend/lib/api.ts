export interface SearchResult {
  id: string;
  title: string;
  cover: string | null;
  url: string;
  source: string;
  description?: string | null;
  chapter?: string;
  time?: string;
  chapters?: { number: string; time: string | null }[];
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

export async function searchManga(q: string, source = "all"): Promise<SearchResult[]> {
  const data = await fetchJson<{ results: SearchResult[] }>(`/api/reader/search?q=${encodeURIComponent(q)}&source=${source}`);
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

export async function getLatest(source = "all", page = 1): Promise<SearchResult[]> {
  const data = await fetchJson<{ results: SearchResult[] }>(`/api/reader/latest?source=${source}&page=${page}`);
  return data.results;
}
