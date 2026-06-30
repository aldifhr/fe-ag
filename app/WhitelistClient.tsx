"use client";

import { useQuery } from "@tanstack/react-query";
import { getWhitelist } from "@/lib/api";
import MangaCard from "@/components/MangaCard";

const GRID_CLASS = "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3";

export function WhitelistClient() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["whitelist"],
    queryFn: () => getWhitelist(1, 100),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold tracking-tight text-(--color-text)">Whitelist</h1>
        <div className={GRID_CLASS}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="skeleton aspect-3/4 w-full rounded-lg" />
              <div className="skeleton h-3.5 w-3/4 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold tracking-tight text-(--color-text)">Whitelist</h1>
        <div className="flex flex-col items-center justify-center py-16 text-(--color-text-muted) gap-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm">Gagal mengambil data</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-(--color-accent) text-white hover:opacity-90 transition-opacity"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  const items = data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight text-(--color-text)">Whitelist</h1>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-(--color-text-muted) gap-3">
          <p className="text-sm">Belum ada manhwa di whitelist</p>
        </div>
      ) : (
        <div className={GRID_CLASS}>
          {items.map((item, i) => (
            <MangaCard
              key={`${item.id}-${i}`}
              title={item.title}
              cover={item.cover}
              id={item.id}
              status={item.status}
              rating={item.rating}
            />
          ))}
        </div>
      )}
    </div>
  );
}
