"use client";

import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLatest, SearchResult } from "@/lib/api";
import MangaCard from "@/components/MangaCard";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import Spinner from "@/components/Spinner";
import { GRID_CLASS } from "@/lib/gridClass";
import SkeletonGrid from "@/components/SkeletonGrid";
import { useInfiniteScroll } from "@/lib/hooks/useInfiniteScroll";
import EmptyState from "@/components/EmptyState";

export default function LatestPage() {
  useEffect(() => {
    document.title = "Baru Diupdate | Manga Reader";
  }, []);

  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [extraItems, setExtraItems] = useState<SearchResult[]>([]);

  const { data: initialData, isLoading } = useQuery({
    queryKey: ["latest-page"],
    queryFn: () => getLatest("all", 1, "latest"),
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
      const res = await getLatest("all", nextPage, "latest");
      setExtraItems((prev) => [...prev, ...res]);
      setPage(nextPage);
      setHasMore(res.length >= 50);
    } catch {
      /* silent */
    }
    setLoadingMore(false);
  }, [page, loadingMore, hasMore]);

  const sentinelRef = useInfiniteScroll(loadMore, { enabled: !isLoading && hasMore });

  return (
    <div className="space-y-6">
      <SectionErrorBoundary>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Baru Diupdate
          </h1>
        </div>

        {/* Content */}
        {isLoading ? (
          <SkeletonGrid />
        ) : items.length === 0 ? (
          <EmptyState title="Tidak ada manga ditemukan untuk source ini." />
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

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-1" />
            {loadingMore && (
              <div className="flex justify-center py-6">
                <div className="flex items-center gap-2 text-[13px] text-(--color-text-muted)">
                  <Spinner size={14} />
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
