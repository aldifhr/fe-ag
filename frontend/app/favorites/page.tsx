"use client";
import { useState, useEffect } from "react";
import { getFavorites, FavoriteManga } from "@/lib/favorites";
import MangaCard from "@/components/MangaCard";
// TODO: shared DRY modules (created by parallel agent)
import EmptyState from "@/components/EmptyState";
import HeartIcon from "@/components/HeartIcon";
import { GRID_CLASS } from "@/lib/gridClass";

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
        <div className={GRID_CLASS}>
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
        <EmptyState
          icon={<HeartIcon />}
          title="Belum ada manga favorit"
          subtitle="Klik ikon hati di manga untuk menambahkan ke favorit"
        />
      ) : (
        <div className={GRID_CLASS}>
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
