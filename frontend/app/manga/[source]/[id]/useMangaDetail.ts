"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMangaDetail,
  MangaDetail,
  getGenreManga,
  getLatest,
  SearchResult,
} from "@/lib/api";
import { isFavorite } from "@/lib/favorites";
import {
  getReadChapters,
  getLastReadChapter,
  getContinueReading,
} from "@/lib/history";

export function useMangaDetail({ initialData }: { initialData?: MangaDetail }) {
  const params = useParams<{ source: string; id: string }>();
  const source = params.source;
  const id = params.id;

  const [descExpanded, setDescExpanded] = useState(false);
  const [fav, setFav] = useState(false);
  const [readChapters, setReadChapters] = useState<Set<string>>(new Set());
  const [chapterPage, setChapterPage] = useState(1);
  const [lastRead, setLastRead] = useState<number | null>(null);
  const [chapterJump, setChapterJump] = useState("");
  const [jumpError, setJumpError] = useState<string | null>(null);
  const [chapterSort, setChapterSort] = useState<"desc" | "asc">("desc");
  const [chapterSearch, setChapterSearch] = useState("");
  const [showAllChapters, setShowAllChapters] = useState(false);
  const continueReading = useMemo(() => getContinueReading(), []);

  const mangaId = useMemo(() => {
    // For Ikiru: id is a slug (e.g., "high-class"), no extraction needed
    if (source === "ikiru") return id;
    // For Shinigami: id may be a full URL — extract the UUID or numeric ID
    return id.includes("://")
      ? ((id.match(/\/([0-9a-f-]{36}|\d+)\/?$/i) ||
          id.match(/\/([^/]+)\/?$/))?.[1] ?? id)
      : id;
  }, [id, source]);

  const {
    data,
    isLoading,
    error: queryError,
  } = useQuery<MangaDetail>({
    queryKey: ["manga", id],
    queryFn: () => getMangaDetail(mangaId, source),
    staleTime: 5 * 60 * 1000,
    initialData,
  });

  const queryClient = useQueryClient();

  // Prefetch genre-based recommendations so "Serupa" section loads instantly
  useEffect(() => {
    if (data?.manga.genres?.[0]) {
      queryClient.prefetchQuery({
        queryKey: ["genre-manga", data.manga.genres[0], 1],
        queryFn: () => getGenreManga(data.manga.genres[0], 1),
        staleTime: 10 * 60 * 1000,
      });
    }
  }, [data?.manga.genres, queryClient]);

  const errorMsg = queryError
    ? queryError instanceof Error
      ? queryError.message
      : String(queryError)
    : null;

  useEffect(() => {
    setFav(isFavorite(id));
    setReadChapters(getReadChapters(id));
    setLastRead(getLastReadChapter(id));
  }, [id]);

  // Sort chapters
  const chapters = data?.chapters ?? [];
  const sortedChapters = useMemo(() => {
    const sorted = [...chapters];
    sorted.sort((a, b) => {
      const numA = Number(a.number);
      const numB = Number(b.number);
      return chapterSort === "desc" ? numB - numA : numA - numB;
    });
    return sorted;
  }, [chapters, chapterSort]);

  // Filter chapters by search
  const filteredChapters = useMemo(() => {
    const q = chapterSearch.trim();
    return q
      ? sortedChapters.filter((ch) => String(ch.number).includes(q))
      : sortedChapters;
  }, [sortedChapters, chapterSearch]);

  // Reset pagination when search changes
  useEffect(() => {
    setChapterPage(1);
  }, [chapterSearch]);

  // Genre-based recommendations (fallback to random if no genres)
  const firstGenre = data?.manga.genres?.[0] ?? null;

  const { data: recommendations = [] } = useQuery<SearchResult[]>({
    queryKey: firstGenre
      ? ["similar", data?.manga.id, firstGenre]
      : ["recommendations", data?.manga.id],
    queryFn: async () => {
      if (firstGenre) {
        const results = await getGenreManga(firstGenre, 1);
        return results.filter((m) => m.id !== data!.manga.id).slice(0, 6);
      }
      // Fallback: fetch latest and shuffle
      const latest = await getLatest("shinigami", 1);
      const filtered = latest.filter((m) => m.id !== data!.manga.id);
      for (let i = filtered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
      }
      return filtered.slice(0, 6);
    },
    enabled: !!data?.manga.id,
    staleTime: 10 * 60 * 1000,
  });

  return {
    // Data
    manga: data?.manga ?? null,
    isLoading,
    errorMsg,
    recommendations,
    continueReading,

    // Chapter filter/sort state
    chapterSort,
    setChapterSort,
    chapterSearch,
    setChapterSearch,
    chapterPage,
    setChapterPage,
    chapterJump,
    setChapterJump,
    jumpError,
    setJumpError,
    filteredChapters,
    sortedChapters,
    showAllChapters,
    setShowAllChapters,

    // Reading state
    lastRead,
    readChapters,
    setReadChapters,
    fav,
    setFav,
    descExpanded,
    setDescExpanded,

    // Identifiers
    source,
    id,
  };
}
