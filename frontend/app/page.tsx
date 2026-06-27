"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { getLatest, SearchResult } from "@/lib/api";
import { getContinueReading } from "@/lib/history";
import MangaCard from "@/components/MangaCard";

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="skeleton aspect-[3/4] w-full rounded-lg" />
          <div className="skeleton h-3.5 w-3/4 rounded" />
          <div className="skeleton h-3 w-1/2 rounded" />
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const [items, setItems] = useState<SearchResult[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [continueReading, setContinueReading] = useState<ReturnType<typeof getContinueReading>>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Load continue reading
  useEffect(() => {
    setContinueReading(getContinueReading());
  }, []);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setItems([]);
    setPage(1);
    setHasMore(true);

    getLatest("shinigami", 1)
      .then((res) => {
        if (!cancelled) {
          setItems(res);
          setHasMore(res.length >= 50);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [retryKey]);

  // Infinite scroll
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const res = await getLatest("shinigami", nextPage);
      setItems((prev) => [...prev, ...res]);
      setPage(nextPage);
      setHasMore(res.length >= 50);
    } catch { /* silent */ }
    setLoadingMore(false);
  }, [page, loadingMore, hasMore]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && hasMore) loadMore();
      },
      { rootMargin: "200px" }
    );
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [loading, hasMore, loadMore]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Update Terbaru
        </h1>
        {!loading && (
          <p className="text-[13px] text-[var(--color-text-muted)] mt-0.5">
            {items.length} manga
          </p>
        )}
      </div>

      {/* Lanjutkan Baca */}
      {continueReading && (
        <Link
          href={`/manga/shinigami/${continueReading.mangaId}/${continueReading.chapterNumber}`}
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3 flex items-center gap-3 hover:border-[var(--color-accent)] transition-colors duration-150"
        >
          {continueReading.cover ? (
            <img
              src={continueReading.cover}
              alt={continueReading.title}
              className="w-12 h-16 object-cover rounded shrink-0"
            />
          ) : (
            <div className="w-12 h-16 bg-[var(--color-bg)] border border-[var(--color-border)] rounded flex items-center justify-center text-[var(--color-text-muted)] text-[10px]">
              No Cover
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-[var(--color-text)] line-clamp-1">
              {continueReading.title}
            </p>
            <p className="text-[12px] text-[var(--color-text-muted)]">
              Chapter {continueReading.chapterNumber}
            </p>
          </div>
          <svg
            className="text-[var(--color-text-muted)] shrink-0"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      )}

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
                chapters={item.chapters}
              />
            ))}
          </div>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-1" />
          {loadingMore && (
            <div className="flex justify-center py-6">
              <div className="flex items-center gap-2 text-[13px] text-[var(--color-text-muted)]">
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-6.219-8.56"/>
                </svg>
                Memuat...
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
