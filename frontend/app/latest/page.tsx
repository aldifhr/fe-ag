"use client";

import { useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLatest } from "@/lib/api";
import MangaCard from "@/components/MangaCard";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import Spinner from "@/components/Spinner";
import { GRID_CLASS } from "@/lib/gridClass";
import SkeletonGrid from "@/components/SkeletonGrid";
import { usePagedFetch } from "@/lib/hooks/usePagedFetch";
import EmptyState from "@/components/EmptyState";

export default function LatestPage() {
  useEffect(() => {
    document.title = "Baru Diupdate | Manga Reader";
  }, []);

  const { data: initialData, isLoading } = useQuery({
    queryKey: ["latest-page"],
    queryFn: () => getLatest("all", 1, "latest"),
  });

  const fetchFn = useCallback((p: number) => getLatest("all", p, "latest"), []);

  const { items, loadingMore, sentinelRef } = usePagedFetch(initialData, fetchFn);

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
