export interface FavoriteManga {
  id: string;
  title: string;
  cover: string | null;
  source: string;
  addedAt: number; // timestamp
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

export function getFavorites(): FavoriteManga[] {
  return safeGetFavorites();
}

export function isFavorite(id: string): boolean {
  return safeGetFavorites().some((f) => f.id === id);
}

export function addFavorite(manga: Omit<FavoriteManga, "addedAt">): FavoriteManga[] {
  const favorites = safeGetFavorites();
  if (favorites.some((f) => f.id === manga.id)) return favorites;
  const updated = [{ ...manga, addedAt: Date.now() }, ...favorites];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function removeFavorite(id: string): FavoriteManga[] {
  const favorites = safeGetFavorites().filter((f) => f.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  return favorites;
}
