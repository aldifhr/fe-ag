"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  getLatest,
  getRandomManga,
  getPopularToday,
  getGenres,
  SearchResult,
  proxyCover,
} from "@/lib/api";
import { checkConnection } from "@/lib/connection";
import {
  getGroupedHistory,
  formatChapters,
  timeAgo,
  GroupedHistory,
} from "@/lib/history";
import MangaCard from "@/components/MangaCard";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";

function SkeletonGrid() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex gap-3 p-3 rounded-lg bg-(--color-surface) border border-(--color-border)"
        >
          <div className="w-14 h-20 skeleton rounded-md shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <div className="skeleton h-4 w-2/3 rounded" />
            <div className="skeleton h-3 w-1/2 rounded" />
            <div className="skeleton h-3 w-1/4 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

type SortOption = "latest" | "popularity" | "rating" | "az";
type SourceOption = "all" | "shinigami" | "ikiru";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "latest", label: "Terbaru" },
  { value: "popularity", label: "Populer" },
  { value: "rating", label: "Rating" },
  { value: "az", label: "A-Z" },
];

const SOURCE_OPTIONS: { value: SourceOption; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "shinigami", label: "Shinigami" },
  { value: "ikiru", label: "Ikiru" },
];

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
  const [extraItems, setExtraItems] = useState<SearchResult[]>([]);
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
      if (stored === "all" || stored === "shinigami" || stored === "ikiru")
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
    setRecentHistory(history.slice(0, 5));
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

  // Sync extra items when initial data changes (refetch / mount)
  useEffect(() => {
    if (initialData) {
      setExtraItems([]);
      setPage(1);
      setHasMore(initialData.length >= 50);
    }
  }, [initialData]);

  const rawItems = [...(initialData ?? []), ...extraItems];
  const items =
    sort === "az"
      ? [...rawItems].sort((a, b) => a.title.localeCompare(b.title, "id"))
      : rawItems;

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

  // Helper for horizontal scroll item cards (reused by updated + popular sections)
  function SectionCard({ item }: { item: SearchResult }) {
    return (
      <Link
        href={`/manga/${item.source}/${encodeURIComponent(item.id)}`}
        className="shrink-0 w-40 rounded-lg bg-(--color-surface) border border-(--color-border) hover:border-(--color-accent) transition-colors duration-150 overflow-hidden"
      >
        <div className="w-full h-50 bg-(--color-bg)">
          {item.cover ? (
            <img
              src={proxyCover(item.cover)}
              alt={item.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-(--color-text-muted) text-[10px]">
              No Cover
            </div>
          )}
        </div>
        <div className="p-2">
          <p className="text-[12px] font-medium text-(--color-text) line-clamp-2 leading-tight">
            {item.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {item.chapter && (
              <p className="text-[10px] text-(--color-text-muted)">
                Ch. {item.chapter}
              </p>
            )}
            {item.rating != null && Number(item.rating) > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-500">
                <svg
                  width="8"
                  height="8"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {Number(item.rating).toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section 1: Baru Diupdate (Recently Updated) */}
      {updatedData && updatedData.length > 0 && (
        <SectionErrorBoundary>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-(--color-text-muted)">
                Baru Diupdate
              </h2>
              <Link
                href="/latest"
                className="text-[12px] text-(--color-accent) hover:underline"
              >
                Lihat Semua &rarr;
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {updatedData.slice(0, 6).map((item, i) => (
                <SectionCard key={`upd-${item.id}-${i}`} item={item} />
              ))}
            </div>
          </div>
        </SectionErrorBoundary>
      )}

      {/* Section 2: Populer (Popular/Trending) */}
      {popularQuery.data && popularQuery.data.length > 0 && (
        <SectionErrorBoundary>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-(--color-text-muted)">
                Populer
              </h2>
              <button
                onClick={() => setSort("popularity")}
                className="text-[12px] text-(--color-accent) hover:underline"
              >
                Lihat Semua &rarr;
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {popularQuery.data.slice(0, 6).map((item, i) => (
                <SectionCard key={`pop-${item.id}-${i}`} item={item} />
              ))}
            </div>
          </div>
        </SectionErrorBoundary>
      )}

      {/* Section 4: Genre Populer */}
      {genresQuery.data && genresQuery.data.length > 0 && (
        <SectionErrorBoundary>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-(--color-text-muted)">
                Genre Populer
              </h2>
              <Link
                href="/genres"
                className="text-[12px] text-(--color-accent) hover:underline"
              >
                Lihat Semua &rarr;
              </Link>
            </div>
            <div className="flex gap-2 flex-wrap">
              {genresQuery.data
                .filter((g) =>
                  [
                    "action",
                    "romance",
                    "fantasy",
                    "comedy",
                    "drama",
                    "isekai",
                    "adventure",
                    "shounen",
                    "slice-of-life",
                    "supernatural",
                    "martial-arts",
                    "sci-fi",
                  ].includes(g.slug),
                )
                .map((g) => (
                  <Link
                    key={g.slug}
                    href={`/genres/${g.slug}`}
                    className="px-3 py-1.5 rounded-full text-[12px] bg-(--color-surface) border border-(--color-border) text-(--color-text) hover:border-(--color-accent) hover:text-(--color-accent) transition-colors duration-150"
                  >
                    {g.name}
                  </Link>
                ))}
            </div>
          </div>
        </SectionErrorBoundary>
      )}

      {/* Section 5: Terakhir dibaca (Continue Reading) */}
      {recentHistory.length > 0 && (
        <SectionErrorBoundary>
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-(--color-text-muted)">
              Terakhir dibaca
            </h2>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
              {recentHistory.map((h) => (
                <Link
                  key={h.mangaId}
                  href={`/manga/shinigami/${encodeURIComponent(h.mangaId)}/${Math.max(...h.chapters)}`}
                  className="flex gap-2.5 shrink-0 w-65 p-2 rounded-lg bg-(--color-surface) border border-(--color-border) hover:border-(--color-accent) transition-colors duration-150"
                >
                  {h.cover ? (
                    <img
                      src={proxyCover(h.cover)}
                      alt={h.title}
                      className="w-10 h-14 object-cover rounded shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-14 bg-(--color-bg) border border-(--color-border) rounded flex items-center justify-center text-(--color-text-muted) text-[9px]">
                      No Cover
                    </div>
                  )}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="text-[13px] font-medium text-(--color-text) line-clamp-1">
                      {h.title}
                    </p>
                    <p className="text-[11px] text-(--color-text-muted) mt-0.5">
                      {formatChapters(h.chapters)}
                    </p>
                    <p className="text-[10px] text-(--color-text-muted) mt-0.5">
                      {timeAgo(h.latestReadAt)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </SectionErrorBoundary>
      )}

      {/* Section 6: Semua Manga (Main Content) */}
      <SectionErrorBoundary>
        {/* Header with sort + random */}
        <div>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-tight">
              Semua Manga
            </h1>
            <div className="flex items-center gap-1.5">
              {/* Random button */}
              <button
                onClick={handleRandom}
                disabled={randomLoading}
                suppressHydrationWarning
                className="w-7 h-7 rounded flex items-center justify-center transition-colors duration-150 bg-(--color-surface) border border-(--color-border) text-(--color-text-muted) hover:text-(--color-accent) hover:border-(--color-accent) disabled:opacity-50"
                aria-label="Random manhwa"
                title="Manga acak"
              >
                {randomLoading ? (
                  <svg
                    className="animate-spin"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                ) : (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="16 3 21 3 21 8" />
                    <line x1="4" y1="20" x2="21" y2="3" />
                    <polyline points="21 16 21 21 16 21" />
                    <line x1="15" y1="15" x2="21" y2="21" />
                    <line x1="4" y1="4" x2="9" y2="9" />
                  </svg>
                )}
              </button>
              {/* Sort pills */}
              <div className="flex items-center bg-(--color-surface) rounded-lg p-0.5 border border-(--color-border)">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSort(opt.value)}
                    suppressHydrationWarning
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors duration-150 ${
                      sort === opt.value
                        ? "bg-(--color-accent) text-white"
                        : "text-(--color-text-muted) hover:text-(--color-text)"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setViewMode("grid")}
                suppressHydrationWarning
                className={`w-7 h-7 rounded flex items-center justify-center transition-colors duration-150 ${
                  viewMode === "grid"
                    ? "bg-(--color-accent) text-white"
                    : "bg-(--color-surface) text-(--color-text-muted) hover:text-(--color-text)"
                }`}
                aria-label="Grid view"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("list")}
                suppressHydrationWarning
                className={`w-7 h-7 rounded flex items-center justify-center transition-colors duration-150 ${
                  viewMode === "list"
                    ? "bg-(--color-accent) text-white"
                    : "bg-(--color-surface) text-(--color-text-muted) hover:text-(--color-text)"
                }`}
                aria-label="List view"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </button>
            </div>
          </div>
          {/* Source filter pills */}
          <div className="flex items-center gap-1.5 mt-2">
            {SOURCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSource(opt.value)}
                suppressHydrationWarning
                className={`px-3 py-1 text-[11px] font-medium rounded-full transition-colors duration-150 ${
                  source === opt.value
                    ? "bg-(--color-accent) text-white"
                    : "bg-(--color-surface) text-(--color-text-muted) hover:text-(--color-text) border border-(--color-border)"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {error ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-(--color-surface) border border-(--color-border) flex items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-danger)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
            </div>
            <p className="text-sm text-(--color-text-secondary)">
              Gagal memuat: {error}
            </p>
            {connStatus && !connStatus.backend && (
              <p className="text-[12px] text-(--color-danger)">
                Tidak dapat terhubung ke server. Pastikan backend berjalan di
                localhost:3000
              </p>
            )}
            {connStatus && connStatus.backend && !connStatus.shinigami && (
              <p className="text-[12px] text-yellow-400">
                Shinigami sedang tidak tersedia
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => refetch()}
                className="px-4 py-2 text-[13px] font-medium rounded-lg bg-(--color-surface) border border-(--color-border) text-(--color-text-secondary) hover:text-(--color-text) hover:border-(--color-border-hover) transition-colors duration-150"
              >
                Coba Lagi
              </button>
              <button
                onClick={async () => {
                  setChecking(true);
                  const result = await checkConnection();
                  setConnStatus(result);
                  setChecking(false);
                }}
                disabled={checking}
                className="px-4 py-2 text-[13px] font-medium rounded-lg bg-(--color-surface) border border-(--color-border) text-(--color-text-secondary) hover:text-(--color-text) hover:border-(--color-border-hover) transition-colors duration-150 disabled:opacity-50"
              >
                {checking ? "Menguji..." : "Test koneksi"}
              </button>
            </div>
            {connStatus && (
              <div className="mt-2 flex items-center gap-4 text-[11px]">
                <span
                  className={
                    connStatus.backend ? "text-emerald-400" : "text-red-400"
                  }
                >
                  Backend: {connStatus.backend ? "OK" : "Offline"}
                </span>
                <span
                  className={
                    connStatus.shinigami ? "text-emerald-400" : "text-red-400"
                  }
                >
                  Shinigami: {connStatus.shinigami ? "OK" : "Offline"}
                </span>
              </div>
            )}
          </div>
        ) : isLoading ? (
          <SkeletonGrid />
        ) : items.length === 0 ? (
          <div className="py-20 text-center text-(--color-text-muted) text-sm">
            Tidak ada manga ditemukan untuk source ini.
          </div>
        ) : (
          <>
            {viewMode === "grid" ? (
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
            ) : (
              <div className="flex flex-col gap-2">
                {items.map((item, i) => (
                  <div
                    key={`${item.source}-${item.id}-${i}`}
                    className="flex gap-3 p-3 rounded-lg bg-(--color-surface) border border-(--color-border) hover:border-(--color-border-hover) transition-colors duration-150"
                  >
                    {/* Cover */}
                    <Link
                      href={`/manga/${item.source}/${encodeURIComponent(item.id)}`}
                      className="shrink-0"
                    >
                      <div className="w-14 h-20 shrink-0 rounded overflow-hidden bg-(--color-surface)">
                        {item.cover ? (
                          <img
                            src={proxyCover(item.cover)}
                            alt={item.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-(--color-text-muted) text-[9px]">
                            No Cover
                          </div>
                        )}
                      </div>
                    </Link>
                    {/* Title + chapters below */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                      <Link
                        href={`/manga/${item.source}/${encodeURIComponent(item.id)}`}
                        className="min-w-0"
                      >
                        <h3 className="text-[13px] font-medium text-(--color-text) line-clamp-1">
                          {item.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider rounded bg-(--color-surface-hover) text-(--color-text-muted)">
                            {item.source}
                          </span>
                          {item.status != null &&
                            (() => {
                              const s =
                                typeof item.status === "number"
                                  ? [1].includes(item.status)
                                    ? "Ongoing"
                                    : [2].includes(item.status)
                                      ? "Completed"
                                      : [3].includes(item.status)
                                        ? "Hiatus"
                                        : null
                                  : item.status;
                              return s ? (
                                <span className="text-[10px] text-(--color-text-muted)">
                                  {s}
                                </span>
                              ) : null;
                            })()}
                        </div>
                      </Link>
                      {/* Chapters below title */}
                      {item.chapters && item.chapters.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {item.chapters.slice(0, 2).map((ch, ci) => (
                            <Link
                              key={ci}
                              href={`/manga/${item.source}/${encodeURIComponent(item.id)}/${ch.number}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[11px] text-(--color-text-muted) hover:text-(--color-accent) transition-colors"
                            >
                              Ch. {ch.number}{" "}
                              {ch.time
                                ? `· ${timeAgo(new Date(ch.time).getTime())}`
                                : ""}
                            </Link>
                          ))}
                        </div>
                      ) : item.chapter ? (
                        <Link
                          href={`/manga/${item.source}/${encodeURIComponent(item.id)}/${item.chapter}`}
                          className="text-[11px] text-(--color-text-muted) hover:text-(--color-accent) transition-colors"
                        >
                          Ch. {item.chapter}{" "}
                          {item.time
                            ? `· ${timeAgo(new Date(item.time).getTime())}`
                            : ""}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-1" />
            {loadingMore && (
              <div className="flex justify-center py-6">
                <div className="flex items-center gap-2 text-[13px] text-(--color-text-muted)">
                  <svg
                    className="animate-spin"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
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
