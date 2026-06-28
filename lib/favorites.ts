export interface FavoriteManga {
  id: string;
  title: string;
  cover: string | null;
  source: string;
  addedAt: number;
}

const STORAGE_KEY = "manhwa-favorites";

function safeGetFavorites(): FavoriteManga[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function notify() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("manhwa-favorites-change"));
  }
}

// ─── Sync (localStorage) — fallback when offline / not signed in ──

export function getFavorites(): FavoriteManga[] {
  return safeGetFavorites();
}

export function isFavorite(id: string): boolean {
  return safeGetFavorites().some((f) => f.id === id);
}

export function addFavorite(
  manga: Omit<FavoriteManga, "addedAt">,
): FavoriteManga[] {
  const favorites = safeGetFavorites();
  if (favorites.some((f) => f.id === manga.id)) return favorites;
  const updated = [{ ...manga, addedAt: Date.now() }, ...favorites];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  notify();
  return updated;
}

export function removeFavorite(id: string): FavoriteManga[] {
  const favorites = safeGetFavorites().filter((f) => f.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  notify();
  return favorites;
}

// ─── Async (API + localStorage) — try API first, fallback to sync ──

export async function syncFavoritesFromApi(): Promise<FavoriteManga[]> {
  try {
    const res = await fetch("/api/favorites");
    if (!res.ok) throw new Error("API unavailable");
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message);

    const mapped: FavoriteManga[] = json.data.map(
      (f: { manga_id: string; manga_title: string; manga_cover: string; manga_source: string; created_at: string }) => ({
        id: f.manga_id,
        title: f.manga_title,
        cover: f.manga_cover,
        source: f.manga_source,
        addedAt: new Date(f.created_at).getTime(),
      }),
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
    return mapped;
  } catch {
    return getFavorites();
  }
}

export async function addFavoriteApi(
  manga: Omit<FavoriteManga, "addedAt"> & { url?: string },
): Promise<void> {
  const optimistic = addFavorite(manga);
  try {
    const res = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: manga.id,
        title: manga.title,
        cover: manga.cover ?? "",
        source: manga.source,
        url: manga.url ?? "",
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message);
  } catch {
    // Rollback on failure
    removeFavorite(manga.id);
    // Re-add with original timestamp if available
    const orig = optimistic.find((f) => f.id === manga.id);
    if (orig) {
      const restored = safeGetFavorites().filter((f) => f.id !== manga.id);
      restored.push(orig);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(restored));
    }
  }
}

export async function removeFavoriteApi(id: string): Promise<void> {
  const before = safeGetFavorites();
  removeFavorite(id);
  try {
    const res = await fetch(`/api/favorites?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message);
  } catch {
    // Rollback
    const original = before.find((f) => f.id === id);
    if (original) {
      const restored = safeGetFavorites();
      restored.unshift(original);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(restored));
    }
    notify();
  }
}
