"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getGenreManga, SearchResult } from "@/lib/api";
import MangaCard from "@/components/MangaCard";

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="rounded-lg overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)]">
          <div className="aspect-[3/4] skeleton" />
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

    return () => { cancelled = true; };
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
    } catch { /* silent */ }
    setLoadingMore(false);
  }, [slug, page, loadingMore, hasMore]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Link
          href="/genres"
          className="inline-flex items-center gap-1 text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/>
            <path d="M12 19l-7-7 7-7"/>
          </svg>
          Semua Genre
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">{formatSlug(slug)}</h1>
      </div>

      {/* Content */}
      {error ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4"/>
              <path d="M12 16h.01"/>
            </svg>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">Gagal memuat: {error}</p>
          <button
            onClick={() => setRetryKey((k) => k + 1)}
            className="px-4 py-2 text-[13px] font-medium rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] transition-colors duration-150"
          >
            Coba Lagi
          </button>
        </div>
      ) : loading ? (
        <SkeletonGrid />
      ) : items.length === 0 ? (
        <div className="py-20 text-center text-[var(--color-text-muted)] text-sm">
          Tidak ada manga untuk genre ini
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

          {hasMore && (
            <div className="flex justify-center py-4">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-6 py-2.5 text-[13px] font-medium rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] transition-colors duration-150 disabled:opacity-50"
              >
                {loadingMore ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 11-6.219-8.56"/>
                    </svg>
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
