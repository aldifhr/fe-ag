"use client";
import { useState, useEffect, useRef } from "react";
import { getFavorites, removeFavorite, FavoriteManga } from "@/lib/favorites";
import MangaCard from "@/components/MangaCard";
import EmptyState from "@/components/EmptyState";
import HeartIcon from "@/components/HeartIcon";
import { GRID_CLASS } from "@/lib/gridClass";
import { useOutsideClick } from "@/lib/hooks/useOutsideClick";
import { showToast } from "@/lib/toast";

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteManga[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  const refresh = () => setFavorites(getFavorites());

  useEffect(() => {
    refresh();
    setLoaded(true);
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  useOutsideClick(confirmRef, () => setConfirmClear(false), confirmClear);

  const sorted = [...favorites].sort((a, b) => b.addedAt - a.addedAt);

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    // Remove all favorites by id
    for (const f of favorites) removeFavorite(f.id);
    setFavorites([]);
    setConfirmClear(false);
    showToast("Semua bookmark dihapus");
  };

  if (!loaded) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold tracking-tight">Bookmark</h1>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Bookmark</h1>
          {sorted.length > 0 && (
            <p className="text-[13px] text-(--color-text-muted) mt-0.5">
              {sorted.length} bookmark
            </p>
          )}
        </div>
        {sorted.length > 0 && (
          <button
            ref={confirmRef}
            onClick={handleClear}
            className={`px-3 py-1.5 text-[13px] font-medium rounded-lg transition-colors duration-150 border ${
              confirmClear
                ? "text-white bg-(--color-danger) border-(--color-danger) hover:opacity-90"
                : "text-(--color-danger) hover:bg-(--color-surface) border-(--color-border)"
            }`}
          >
            {confirmClear ? "Yakin hapus?" : "Hapus Semua"}
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={<HeartIcon />}
          title="Belum ada bookmark"
          subtitle="Klik ikon hati di manga untuk menambahkan ke bookmark"
        />
      ) : (
        <div className={GRID_CLASS}>
          {sorted.map((item) => (
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
