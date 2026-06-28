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
import Link from "next/link";
import { DetailHero } from "./DetailHero";
import { ChapterList } from "./ChapterList";
import { Serupa } from "./Serupa";
import { ContinueReadingCTA } from "./ContinueReadingCTA";

function Skeleton() {
  return (
    <div className="flex flex-col md:flex-row gap-6 md:gap-8 mb-10">
      <div className="w-36 md:w-48 shrink-0 mx-auto md:mx-0">
        <div className="skeleton w-full aspect-3/4 rounded-lg" />
      </div>
      <div className="flex-1 min-w-0 pt-2">
        <div className="skeleton h-8 w-3/4 mb-3 rounded" />
        <div className="skeleton h-4 w-24 mb-4 rounded" />
        <div className="flex gap-2 mb-4">
          <div className="skeleton h-5 w-14 rounded" />
          <div className="skeleton h-5 w-16 rounded" />
          <div className="skeleton h-5 w-12 rounded" />
        </div>
        <div className="skeleton h-4 w-full mb-1.5 rounded" />
        <div className="skeleton h-4 w-5/6 mb-1.5 rounded" />
        <div className="skeleton h-4 w-2/3 rounded" />
      </div>
    </div>
  );
}

export function MangaDetailClient({ initialData }: { initialData?: MangaDetail }) {
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

  if (errorMsg) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-lg font-semibold mb-2">Manga tidak ditemukan</h1>
        <p className="text-sm text-text-muted mb-4">{errorMsg}</p>
        <Link
          href="/"
          className="text-[13px] text-accent hover:text-accent-hover transition-colors"
        >
          &larr; Kembali ke beranda
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-[60vh]">
        <Skeleton />
      </div>
    );
  }

  const { manga } = data;

  return (
    <div>
      <DetailHero
        manga={manga}
        id={id}
        fav={fav}
        setFav={setFav}
        descExpanded={descExpanded}
        setDescExpanded={setDescExpanded}
      />

      <ChapterList
        source={source}
        id={id}
        mangaTitle={manga.title}
        mangaCover={manga.cover}
        mangaSource={manga.source}
        mangaUrl={manga.url}
        filteredChapters={filteredChapters}
        sortedChapters={sortedChapters}
        lastRead={lastRead}
        chapterSearch={chapterSearch}
        setChapterSearch={setChapterSearch}
        chapterSort={chapterSort}
        setChapterSort={setChapterSort}
        chapterPage={chapterPage}
        setChapterPage={setChapterPage}
        chapterJump={chapterJump}
        setChapterJump={setChapterJump}
        jumpError={jumpError}
        setJumpError={setJumpError}
        readChapters={readChapters}
        setReadChapters={setReadChapters}
        showAllChapters={showAllChapters}
        setShowAllChapters={setShowAllChapters}
      />

      <Serupa recommendations={recommendations} />

      <ContinueReadingCTA
        continueReading={continueReading}
        source={source}
        id={id}
      />
    </div>
  );
}
