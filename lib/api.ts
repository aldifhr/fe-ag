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

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface CatalogPage {
  results: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getWhitelist(
  page = 1,
  pageSize = 50,
  search = "",
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (search) params.set("search", search);
  const data = await fetchJson<{ results: SearchResult[] }>(
    `/api/reader/whitelist?${params}`,
  );
  return data.results;
}

export async function getCatalogPage(
  page = 1,
  pageSize = 50,
  search = "",
): Promise<CatalogPage> {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (search) params.set("search", search);
  return fetchJson<CatalogPage>(`/api/reader/whitelist?${params}`);
}

export interface HistoryItem {
  title: string;
  chapter: string;
  url: string;
  source: string;
  sentAt: string;
  cover: string;
  updatedTime: string | null;
}

export async function getRecentHistory(): Promise<HistoryItem[]> {
  const data = await fetchJson<{
    success: boolean;
    data: { items: HistoryItem[] };
  }>("/api/reader/history?endpoint=recent");
  return data.data?.items ?? [];
}

/** Return direct image URL — no server-side proxy to avoid CDN IP blocks */
export function proxyCover(url: string | null): string {
  return url ?? "";
}
