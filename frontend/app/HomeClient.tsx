"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
import type { SearchResult, Genre } from "@/lib/api";
import {
  getGroupedHistory,
  GroupedHistory,
} from "@/lib/history";
import type { SortOption, SourceOption } from "@/lib/home-types";
import { readLS } from "@/lib/readLS";
import { usePagedFetch } from "@/lib/hooks/usePagedFetch";
import SedangDibaca from "@/components/sections/SedangDibaca";
import BaruDiupdate from "@/components/sections/BaruDiupdate";
import Populer from "@/components/sections/Populer";
import GenrePopuler from "@/components/sections/GenrePopuler";
import KamuMungkinSuka from "@/components/sections/KamuMungkinSuka";
import SemuaManga from "@/components/sections/SemuaManga";

interface HomeClientProps {
  initialLatest?: SearchResult[];
  initialPopular?: SearchResult[];
  initialGenres?: Genre[];
}

export function HomeClient({
  initialLatest,
  initialPopular,
  initialGenres,
}: HomeClientProps) {
  const router = useRouter();
  const [connStatus, setConnStatus] = useState<{
    backend: boolean;
    shinigami: boolean;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [recentHistory, setRecentHistory] = useState<GroupedHistory[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">(() =>
    readLS<"grid" | "list">("manhwa-view-mode", ["grid", "list"], "grid"),
  );
  const [sort, setSort] = useState<SortOption>(() =>
    readLS<SortOption>("manhwa-sort", ["latest", "popularity", "rating", "az"], "latest"),
  );
  const [source, setSource] = useState<SourceOption>(() =>
    readLS<SourceOption>("manhwa-source", ["all", "shinigami"], "all"),
  );
  const [randomLoading, setRandomLoading] = useState(false);

  const isDefaultView = source === "all" && sort === "latest";

  const {
    data: initialData,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ["latest", source, sort],
    queryFn: () => getLatest(source, 1, sort === "az" ? "latest" : sort),
    // Only seed server data when params match what server fetched
    initialData: isDefaultView ? initialLatest : undefined,
    initialDataUpdatedAt: isDefaultView ? Date.now() : undefined,
  });

  const error = queryError?.message ?? null;

  const fetchFn = useCallback(
    (p: number) => getLatest(source, p, sort === "az" ? "latest" : sort),
    [source, sort],
  );

  const { items, loadingMore, sentinelRef } = usePagedFetch(initialData, fetchFn);

  // Client-side A-Z sort (API doesn't support alphabetical sort)
  const sortedItems = useMemo(
    () => sort === "az" ? [...items].sort((a, b) => a.title.localeCompare(b.title, "id")) : items,
    [items, sort],
  );

  useEffect(() => {
    const history = getGroupedHistory();
    setRecentHistory(history.slice(0, 8));
  }, []);

  // Reuse initialData for "Baru Diupdate" when it's already fetching all+latest
  const updatedQuery = useQuery({
    queryKey: ["home-updated"],
    queryFn: () => getLatest("all", 1, "latest"),
    staleTime: 10 * 60 * 1000,
    enabled: !isDefaultView,
  });
  const updatedData = isDefaultView ? initialData : updatedQuery.data;

  const popularQuery = useQuery({
    queryKey: ["home-popular"],
    queryFn: () => getPopularToday(),
    staleTime: 10 * 60 * 1000,
    initialData: initialPopular,
    initialDataUpdatedAt: initialPopular ? Date.now() : undefined,
  });

  const genresQuery = useQuery({
    queryKey: ["home-genres"],
    queryFn: () => getGenres(),
    staleTime: 30 * 60 * 1000,
    initialData: initialGenres,
    initialDataUpdatedAt: initialGenres ? Date.now() : undefined,
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
        items={sortedItems}
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
