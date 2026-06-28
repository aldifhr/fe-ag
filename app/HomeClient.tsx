"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
import type { SourceOption } from "@/lib/home-types";
import { readLS } from "@/lib/readLS";
import { usePagedFetch } from "@/lib/hooks/usePagedFetch";
import SedangDibaca from "@/components/sections/SedangDibaca";
import SemuaManga from "@/components/sections/SemuaManga";

import GenreChips from "@/components/sections/GenreChips";

interface HomeClientProps {
  initialLatest?: SearchResult[];
  initialGenres?: { slug: string; name: string }[];
}

export function HomeClient({
  initialLatest,
  initialGenres,
}: HomeClientProps) {
  const router = useRouter();
  const [connStatus, setConnStatus] = useState<{
    backend: boolean;
    shinigami: boolean;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [recentHistory, setRecentHistory] = useState<GroupedHistory[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [source, setSource] = useState<SourceOption>("all");
  const [randomLoading, setRandomLoading] = useState(false);

  // Hydrate from localStorage after mount to avoid SSR/client mismatch
  const hydrated = useRef(false);
  useEffect(() => {
    setViewMode(readLS<"grid" | "list">("manhwa-view-mode", ["grid", "list"], "grid"));
    setSource(readLS<SourceOption>("manhwa-source", ["all", "shinigami"], "all"));
    hydrated.current = true;
  }, []);

  const isDefaultView = source === "all";

  const {
    data: initialData,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ["latest", source],
    queryFn: () => getLatest(source, 1, "latest"),
    initialData: isDefaultView ? initialLatest : undefined,
    initialDataUpdatedAt: isDefaultView ? Date.now() : undefined,
  });

  const error = queryError?.message ?? null;

  const fetchFn = useCallback(
    (p: number) => getLatest(source, p, "latest"),
    [source],
  );

  const { items, loadingMore, sentinelRef } = usePagedFetch(initialData, fetchFn);

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
    localStorage.setItem("manhwa-source", source);
  }, [source]);

  // Feature 1: Random manhwa handler
  const handleRandom = useCallback(async () => {
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
  }, [router]);

  return (
    <div className="space-y-6">
      <GenreChips genres={initialGenres ?? []} />

      {recentHistory.length > 0 && (
        <SedangDibaca history={recentHistory} />
      )}

      <SemuaManga
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
