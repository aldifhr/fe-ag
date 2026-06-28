"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  getLatest,
  getRandomManga,
} from "@/lib/api";
import type { SearchResult } from "@/lib/api";
import {
  getGroupedHistory,
  GroupedHistory,
} from "@/lib/history";
import type { SortOption, SourceOption } from "@/lib/home-types";
import { readLS } from "@/lib/readLS";
import { usePagedFetch } from "@/lib/hooks/usePagedFetch";
import SedangDibaca from "@/components/sections/SedangDibaca";
import SemuaManga from "@/components/sections/SemuaManga";

interface HomeClientProps {
  initialLatest?: SearchResult[];
}

export function HomeClient({
  initialLatest,
}: HomeClientProps) {
  const router = useRouter();
  const [connStatus, setConnStatus] = useState<{
    backend: boolean;
    shinigami: boolean;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [recentHistory, setRecentHistory] = useState<GroupedHistory[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState<SortOption>("latest");
  const [source, setSource] = useState<SourceOption>("all");
  const [randomLoading, setRandomLoading] = useState(false);

  // Hydrate from localStorage after mount to avoid SSR/client mismatch
  const hydrated = useRef(false);
  useEffect(() => {
    setViewMode(readLS<"grid" | "list">("manhwa-view-mode", ["grid", "list"], "grid"));
    setSort(readLS<SortOption>("manhwa-sort", ["latest", "popularity", "rating", "az"], "latest"));
    setSource(readLS<SourceOption>("manhwa-source", ["all", "shinigami", "ikiru"], "all"));
    hydrated.current = true;
  }, []);

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

  // Persist view mode and sort (skip initial render to avoid overwriting saved prefs with defaults)
  useEffect(() => {
    if (!hydrated.current) return;
    localStorage.setItem("manhwa-view-mode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!hydrated.current) return;
    localStorage.setItem("manhwa-sort", sort);
  }, [sort]);

  useEffect(() => {
    if (!hydrated.current) return;
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
