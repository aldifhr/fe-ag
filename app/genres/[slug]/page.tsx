"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getGenreManga, SearchResult } from "@/lib/api";
import MangaCard from "@/components/MangaCard";
import ErrorState from "@/components/ErrorState";
import EmptyState from "@/components/EmptyState";
import Spinner from "@/components/Spinner";
import { GRID_CLASS } from "@/lib/gridClass";
import SkeletonGrid from "@/components/SkeletonGrid";
import { useInfiniteScroll } from "@/lib/hooks/useInfiniteScroll";

type SortKey = "terbaru" | "judul" | "rating";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "terbaru", label: "Terbaru" },
  { key: "judul", label: "Judul A-Z" },
  { key: "rating", label: "Rating" },
];

function formatSlug(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function GenreMangaPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [items, setItems] = useState<SearchResult[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [sort, setSort] = useState<SortKey>("terbaru");

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setItems([]);
    setPage(1);
    setHasMore(true);

    getGenreManga(slug, 1)
      .then((res) => {
        if (!cancelled) {
          setItems(res);
          setHasMore(res.length >= 20);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, retryKey]);

  // Load more
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const res = await getGenreManga(slug, nextPage);
      setItems((prev) => [...prev, ...res]);
      setPage(nextPage);
      setHasMore(res.length >= 20);
    } catch {
      /* silent */
    }
    setLoadingMore(false);
  }, [slug, page, loadingMore, hasMore]);

  // Sorted items
  const sortedItems = useMemo(() => {
    if (sort === "terbaru") return items;
    const copy = [...items];
    if (sort === "judul") {
      copy.sort((a, b) => a.title.localeCompare(b.title, "id"));
    } else if (sort === "rating") {
      copy.sort((a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0));
    }
    return copy;
  }, [items, sort]);

  // Infinite scroll
  const sentinelRef = useInfiniteScroll(loadMore, {
    enabled: hasMore && !loadingMore,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-(--color-surface) border border-(--color-border) rounded-lg px-4 py-3 space-y-2">
        <Link
          href="/genres"
          className="inline-flex items-center gap-1 text-[13px] text-(--color-text-muted) hover:text-(--color-accent) transition-colors"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          Semua Genre
        </Link>
        <div className="flex items-baseline gap-2">
          <h1 className="text-xl font-semibold tracking-tight">
            {formatSlug(slug)}
          </h1>
          {!loading && items.length > 0 && (
            <span className="text-[13px] text-(--color-text-muted)">
              {items.length} manga
            </span>
          )}
        </div>
      </div>

      {/* Sort */}
      {!loading && items.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-(--color-text-muted)">Urutkan:</span>
          <div className="inline-flex items-center bg-(--color-surface) rounded-lg p-0.5 border border-(--color-border)">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSort(opt.key)}
                className={`px-3 py-1.5 text-[13px] rounded-md transition-colors ${
                  sort === opt.key
                    ? "bg-(--color-accent) text-white"
                    : "text-(--color-text-muted) hover:text-(--color-text)"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {error ? (
        <ErrorState message={`Gagal memuat: ${error}`} onRetry={() => setRetryKey((k) => k + 1)} />
      ) : loading ? (
        <SkeletonGrid variant="grid" />
      ) : sortedItems.length === 0 ? (
        <EmptyState title="Tidak ada manga untuk genre ini" />
      ) : (
        <>
          <div className={GRID_CLASS}>
            {sortedItems.map((item, i) => (
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

          {/* Sentinel for infinite scroll */}
          {hasMore && <div ref={sentinelRef} className="h-1" />}

          {hasMore && (
            <div className="flex justify-center py-4">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-6 py-2.5 text-[13px] font-medium rounded-lg bg-(--color-surface) border border-(--color-border) text-(--color-text-secondary) hover:text-(--color-text) hover:border-(--color-border-hover) transition-colors duration-150 disabled:opacity-50"
              >
                {loadingMore ? (
                  <span className="flex items-center gap-2">
                    <Spinner size={14} />
                    Memuat...
                  </span>
                ) : (
                  "Muat Lebih"
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
