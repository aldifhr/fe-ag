"use client";

import { useQuery } from "@tanstack/react-query";
import { getRecentHistory, type HistoryItem } from "@/lib/api";
import { useState } from "react";

const GRID_CLASS = "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3";

/* ── Helpers ── */

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins}m lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}j lalu`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}h lalu`;
  return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

/* ── History Grid Card ── */

function HistoryGridCard({ item }: { item: HistoryItem }) {
  const [imgErr, setImgErr] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-lg overflow-hidden bg-(--color-surface) border border-(--color-border) hover:border-(--color-border-hover) transition-colors duration-200"
    >
      {/* Cover */}
      <div className="aspect-3/4 relative overflow-hidden bg-(--color-surface)">
        {item.cover && !imgErr ? (
          <img
            src={item.cover}
            alt={item.title}
            referrerPolicy="no-referrer"
            className="relative w-full h-full object-cover transition-[filter,transform] duration-300 group-hover:scale-[1.03]"
            style={{
              filter: imgLoaded ? "none" : "blur(10px)",
              transform: imgLoaded ? "none" : "scale(1.1)",
            }}
            onError={() => setImgErr(true)}
            onLoad={() => setImgLoaded(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-(--color-surface) text-(--color-text-muted) text-sm p-3 text-center leading-relaxed">
            {item.title}
          </div>
        )}
      </div>

      {/* Title */}
      <div className="px-3 py-2.5">
        <h3 className="text-[13px] font-medium leading-snug line-clamp-2 text-(--color-text) group-hover:text-(--color-text-secondary) transition-colors duration-150">
          {item.title}
        </h3>
      </div>

      {/* Chapter + Source badges */}
      <div className="px-3 pb-2.5 flex items-center gap-1.5 flex-wrap mt-auto">
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded text-(--color-text-muted) bg-(--color-surface-hover)">
          {item.chapter}
        </span>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded text-(--color-text-muted) bg-(--color-surface-hover) capitalize">
          {item.source}
        </span>
      </div>
    </a>
  );
}

/* ── Skeleton ── */

function GridSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-7 w-44 rounded" />
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

/* ── Main Component ── */

export function HomeClient() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["recent-history"],
    queryFn: getRecentHistory,
    refetchInterval: 60_000,
  });

  if (isLoading) return <GridSkeleton />;

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold tracking-tight text-(--color-text)">Update Terbaru</h1>
        <div className="flex flex-col items-center justify-center py-16 text-(--color-text-muted) gap-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm">Gagal mengambil update terbaru</p>
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
      <div className="flex items-baseline gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-(--color-text)">Update Terbaru</h1>
        {items.length > 0 && (
          <span className="text-sm text-(--color-text-muted)">{items.length} chapter</span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-(--color-text-muted) gap-3">
          <p className="text-sm">Belum ada update terbaru</p>
        </div>
      ) : (
        <div className={GRID_CLASS}>
          {items.map((item, i) => (
            <HistoryGridCard key={`${item.title}-${i}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
