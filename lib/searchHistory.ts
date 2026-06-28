const KEY = "manhwa-search-history";
const MAX = 8;

export function addSearchHistory(query: string): void {
  const trimmed = query.trim();
  if (!trimmed) return;
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((q) => q !== trimmed);
    filtered.unshift(trimmed);
    localStorage.setItem(KEY, JSON.stringify(filtered.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export function getSearchHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearSearchHistory(): void {
  localStorage.removeItem(KEY);
}

// ─── Async (API + localStorage) ──

export async function syncSearchHistoryFromApi(): Promise<void> {
  try {
    const res = await fetch("/api/user-preferences/search-history?limit=10");
    if (!res.ok) throw new Error("API unavailable");
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message);
    const queries: string[] = json.data.map(
      (d: { query: string }) => d.query,
    );
    localStorage.setItem(KEY, JSON.stringify(queries));
  } catch {
    /* fallback to localStorage */
  }
}

export async function addSearchHistoryApi(query: string): Promise<void> {
  addSearchHistory(query);
  try {
    await fetch("/api/user-preferences/search-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
  } catch {
    /* local already saved */
  }
}

export async function clearSearchHistoryApi(): Promise<void> {
  clearSearchHistory();
  try {
    await fetch("/api/user-preferences/search-history", {
      method: "DELETE",
    });
  } catch {
    /* local already cleared */
  }
}
