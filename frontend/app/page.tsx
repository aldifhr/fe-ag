"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  getLatest,
  getRandomManga,
  getPopularToday,
  getGenres,
  getMangaDetail,
  getGenreManga,
} from "@/lib/api";
import {
  getGroupedHistory,
  GroupedHistory,
} from "@/lib/history";
import type { SortOption, SourceOption } from "@/lib/home-types";
import SedangDibaca from "@/components/sections/SedangDibaca";
import BaruDiupdate from "@/components/sections/BaruDiupdate";
import Populer from "@/components/sections/Populer";
import GenrePopuler from "@/components/sections/GenrePopuler";
import KamuMungkinSuka from "@/components/sections/KamuMungkinSuka";
import SemuaManga from "@/components/sections/SemuaManga";

export default function HomePage() {
  const router = useRouter();
  const [connStatus, setConnStatus] = useState<{
    backend: boolean;
    shinigami: boolean;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [extraItems, setExtraItems] = useState<import("@/lib/api").SearchResult[]>([]);
  const [recentHistory, setRecentHistory] = useState<GroupedHistory[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("manhwa-view-mode");
      if (stored === "grid" || stored === "list") return stored;
    }
    return "grid";
  });
  const [sort, setSort] = useState<SortOption>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("manhwa-sort");
      if (
        stored === "latest" ||
        stored === "popularity" ||
        stored === "rating" ||
        stored === "az"
      )
        return stored;
    }
    return "latest";
  });
  const [source, setSource] = useState<SourceOption>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("manhwa-source");
      if (stored === "all" || stored === "shinigami")
        return stored;
    }
    return "all";
  });
  const [randomLoading, setRandomLoading] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const {
    data: initialData,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ["latest", source, sort],
    queryFn: () => getLatest(source, 1, sort === "az" ? "latest" : sort),
  });

  const error = queryError?.message ?? null;

  useEffect(() => {
    const history = getGroupedHistory();
    setRecentHistory(history.slice(0, 8));
  }, []);

  // Reuse initialData for "Baru Diupdate" when it's already fetching all+latest
  const isDefaultView = source === "all" && sort === "latest";
  const updatedQuery = useQuery({
    queryKey: ["home-updated"],
    queryFn: () => getLatest("all", 1, "latest"),
    staleTime: 10 * 60 * 1000,
    enabled: !isDefaultView, // Skip when main grid already has same data
  });
  const updatedData = isDefaultView ? initialData : updatedQuery.data;

  const popularQuery = useQuery({
    queryKey: ["home-popular"],
    queryFn: () => getPopularToday(),
    staleTime: 10 * 60 * 1000,
  });

  const genresQuery = useQuery({
    queryKey: ["home-genres"],
    queryFn: () => getGenres(),
    staleTime: 30 * 60 * 1000,
  });

  const recommendationsQuery = useQuery({
    queryKey: ["recommendations"],
    queryFn: async () => {
      const topIds = recentHistory.slice(0, 3);
      if (topIds.length === 0) return [];
      const details = await Promise.all(
        topIds.map((h) => getMangaDetail(h.mangaId, h.source)),
      );
      const freq = new Map<string, number>();
      for (const d of details) {
        for (const g of d.manga.genres) {
          freq.set(g, (freq.get(g) ?? 0) + 1);
        }
      }
      const topGenre = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (!topGenre) return [];
      const genreResults = await getGenreManga(topGenre, 1);
      const historyIds = new Set(recentHistory.map((h) => h.mangaId));
      return genreResults.filter((r) => !historyIds.has(r.id)).slice(0, 6);
    },
    enabled: recentHistory.length > 0,
    staleTime: 30 * 60 * 1000,
  });

  // Sync extra items when initial data changes (refetch / mount)
  useEffect(() => {
    if (initialData) {
      setExtraItems([]);
      setPage(1);
      setHasMore(initialData.length >= 50);
    }
  }, [initialData]);

  const items = useMemo(() => {
    const rawItems = [...(initialData ?? []), ...extraItems];
    return sort === "az"
      ? [...rawItems].sort((a, b) => a.title.localeCompare(b.title, "id"))
      : rawItems;
  }, [initialData, extraItems, sort]);

  // Persist view mode and sort
  useEffect(() => {
    localStorage.setItem("manhwa-view-mode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem("manhwa-sort", sort);
  }, [sort]);

  useEffect(() => {
    localStorage.setItem("manhwa-source", source);
  }, [source]);

  // Infinite scroll
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

  // Feature 1: Random manhwa handler
  async function handleRandom() {
    setRandomLoading(true);
    try {
      const result = await getRandomManga();
      if (result?.id) {
        router.push(`/manga/shinigami/${encodeURIComponent(result.id)}`);
      }
    } catch {
      // silent — user just retries
    }
    setRandomLoading(false);
  }

  return (
    <div className="space-y-6">
      {recentHistory.length > 0 && (
        <SedangDibaca history={recentHistory} />
      )}

      <BaruDiupdate items={updatedData} />

      <Populer
        items={popularQuery.data}
        onSeeAll={() => setSort("popularity")}
      />

      <GenrePopuler genres={genresQuery.data} />

      <KamuMungkinSuka
        items={recommendationsQuery.data}
        isLoading={recommendationsQuery.isLoading}
        hasHistory={recentHistory.length > 0}
      />

      <SemuaManga
        sort={sort}
        setSort={setSort}
        source={source}
        setSource={setSource}
        viewMode={viewMode}
        setViewMode={setViewMode}
        items={items}
        isLoading={isLoading}
        error={error}
        refetch={refetch}
        connStatus={connStatus}
        setConnStatus={setConnStatus}
        checking={checking}
        setChecking={setChecking}
        handleRandom={handleRandom}
        randomLoading={randomLoading}
        sentinelRef={sentinelRef}
        loadingMore={loadingMore}
      />
    </div>
  );
}
