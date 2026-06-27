"use client";
import { useState, useEffect } from "react";
import { getFavorites, FavoriteManga } from "@/lib/favorites";
import MangaCard from "@/components/MangaCard";

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteManga[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFavorites(getFavorites());
    setLoaded(true);
  }, []);

  if (!loaded) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold tracking-tight">Favorit</h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="skeleton aspect-3/4 w-full rounded-lg" />
              <div className="skeleton h-3.5 w-3/4 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Favorit</h1>
        {favorites.length > 0 && (
          <p className="text-[13px] text-(--color-text-muted) mt-0.5">
            {favorites.length} manga tersimpan
          </p>
        )}
      </div>

      {favorites.length === 0 ? (
        <div className="py-20 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-(--color-surface) border border-(--color-border) flex items-center justify-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-text-muted)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
          <p className="text-(--color-text-secondary) text-sm mb-1">
            Belum ada manga favorit
          </p>
          <p className="text-(--color-text-muted) text-[13px]">
            Klik ikon hati di manga untuk menambahkan ke favorit
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {favorites.map((item) => (
            <MangaCard
              key={item.id}
              title={item.title}
              cover={item.cover}
              source={item.source}
              id={item.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
