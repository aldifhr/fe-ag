"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getGenreManga, SearchResult } from "@/lib/api";
import MangaCard from "@/components/MangaCard";
// TODO: shared DRY modules (created by parallel agent)
import ErrorState from "@/components/ErrorState";
import EmptyState from "@/components/EmptyState";
import Spinner from "@/components/Spinner";
import ErrorIcon from "@/components/ErrorIcon";
import { GRID_CLASS } from "@/lib/gridClass";

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
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
        <h1 className="text-xl font-semibold tracking-tight">
          {formatSlug(slug)}
        </h1>
      </div>

      {/* Content */}
      {error ? (
        <ErrorState message={`Gagal memuat: ${error}`} onRetry={() => setRetryKey((k) => k + 1)} />
      ) : loading ? (
        <SkeletonGrid />
      ) : items.length === 0 ? (
        <EmptyState title="Tidak ada manga untuk genre ini" />
      ) : (
        <>
          <div className={GRID_CLASS}>
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
