"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLatest, SearchResult } from "@/lib/api";
import MangaCard from "@/components/MangaCard";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg overflow-hidden bg-(--color-surface) border border-(--color-border)"
        >
          <div className="aspect-3/4 skeleton" />
          <div className="px-3 py-2.5 space-y-2">
            <div className="skeleton h-4 w-2/3 rounded" />
            <div className="skeleton h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

type SortOption = "latest" | "popularity" | "rating";
type SourceOption = "all" | "shinigami";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "latest", label: "Terbaru" },
  { value: "popularity", label: "Populer" },
  { value: "rating", label: "Rating" },
];

const SOURCE_OPTIONS: { value: SourceOption; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "shinigami", label: "Shinigami" },
];

export default function LatestPage() {
  useEffect(() => {
    document.title = "Baru Diupdate | Manga Reader";
  }, []);

  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [extraItems, setExtraItems] = useState<SearchResult[]>([]);
  const [sort, setSort] = useState<SortOption>("latest");
  const [source, setSource] = useState<SourceOption>("all");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { data: initialData, isLoading } = useQuery({
    queryKey: ["latest-page", source, sort],
    queryFn: () => getLatest(source, 1, sort),
  });

  // Reset on filter change
  useEffect(() => {
    if (initialData) {
      setExtraItems([]);
      setPage(1);
      setHasMore(initialData.length >= 50);
    }
  }, [initialData]);

  const items = [...(initialData ?? []), ...extraItems];

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const res = await getLatest(source, nextPage, sort);
      setExtraItems((prev) => [...prev, ...res]);
      setPage(nextPage);
      setHasMore(res.length >= 50);
    } catch {
      /* silent */
    }
    setLoadingMore(false);
  }, [page, loadingMore, hasMore, sort, source]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && hasMore) loadMore();
      },
      { rootMargin: "200px" },
    );
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [isLoading, hasMore, loadMore]);

  return (
    <div className="space-y-6">
      <SectionErrorBoundary>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Baru Diupdate
          </h1>
          {/* Sort pills */}
          <div className="flex items-center gap-1.5 mt-2">
            <div className="flex items-center bg-(--color-surface) rounded-lg p-0.5 border border-(--color-border)">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSort(opt.value)}
                  suppressHydrationWarning
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors duration-150 ${
                    sort === opt.value
                      ? "bg-(--color-accent) text-white"
                      : "text-(--color-text-muted) hover:text-(--color-text)"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {/* Source filter pills */}
          <div className="flex items-center gap-1.5 mt-2">
            {SOURCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSource(opt.value)}
                suppressHydrationWarning
                className={`px-3 py-1 text-[11px] font-medium rounded-full transition-colors duration-150 ${
                  source === opt.value
                    ? "bg-(--color-accent) text-white"
                    : "bg-(--color-surface) text-(--color-text-muted) hover:text-(--color-text) border border-(--color-border)"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <SkeletonGrid />
        ) : items.length === 0 ? (
          <div className="py-20 text-center text-(--color-text-muted) text-sm">
            Tidak ada manga ditemukan untuk source ini.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {items.map((item, i) => (
                <MangaCard
                  key={`${item.source}-${item.id}-${i}`}
                  title={item.title}
                  cover={item.cover}
                  source={item.source}
                  id={item.id}
                  chapter={item.chapter}
                  time={item.time}
                  status={item.status}
                  rating={item.rating}
                  chapters={item.chapters}
                />
              ))}
            </div>

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-1" />
            {loadingMore && (
              <div className="flex justify-center py-6">
                <div className="flex items-center gap-2 text-[13px] text-(--color-text-muted)">
                  <svg
                    className="animate-spin"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                  Memuat...
                </div>
              </div>
            )}
          </>
        )}
      </SectionErrorBoundary>
    </div>
  );
}
