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
