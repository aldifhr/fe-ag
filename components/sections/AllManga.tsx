import Link from "next/link";
import { SearchResult, proxyCover } from "@/lib/api";
import { timeAgo } from "@/lib/history";
import MangaCard from "@/components/MangaCard";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import SkeletonGrid from "@/components/SkeletonGrid";
import ConnectionTestPanel from "@/components/ConnectionTestPanel";
import Spinner from "@/components/Spinner";
import EmptyState from "@/components/EmptyState";
import { GRID_CLASS } from "@/lib/gridClass";
import { SOURCE_OPTIONS } from "@/lib/home-types";
import type { SourceOption } from "@/lib/home-types";
import type { RefObject } from "react";



export default function AllManga({
  source,
  setSource,
  viewMode,
  setViewMode,
  items,
  isLoading,
  error,
  refetch,
  connStatus,
  setConnStatus,
  checking,
  setChecking,
  handleRandom,
  randomLoading,
  sentinelRef,
  loadingMore,
}: {
  source: SourceOption;
  setSource: (v: SourceOption) => void;
  viewMode: "grid" | "list";
  setViewMode: (v: "grid" | "list") => void;
  items: SearchResult[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  connStatus: { backend: boolean; shinigami: boolean } | null;
  setConnStatus: (v: { backend: boolean; shinigami: boolean } | null) => void;
  checking: boolean;
  setChecking: (v: boolean) => void;
  handleRandom: () => void;
  randomLoading: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
  loadingMore: boolean;
}) {
  return (
    <SectionErrorBoundary>
      {/* Header with sort + random */}
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Semua Manga</h1>
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
                <Spinner size={14} />
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
        <ConnectionTestPanel
          error={error}
          refetch={refetch}
          connStatus={connStatus}
          setConnStatus={setConnStatus}
          checking={checking}
          setChecking={setChecking}
        />
      ) : isLoading ? (
        <SkeletonGrid />
      ) : items.length === 0 ? (
        <EmptyState title="Tidak ada manga ditemukan untuk source ini." />
      ) : (
        <>
          {viewMode === "grid" ? (
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
                  country={item.country}
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
                        <span className={`px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider rounded ${
                          item.country === "CN"
                            ? "bg-red-600 text-white"
                            : item.country === "JP"
                              ? "bg-blue-600 text-white"
                              : "bg-black text-red-400"
                        }`}>
                          {item.country === "CN" ? "Manhua" : item.country === "JP" ? "Manga" : "Manhwa"}
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
                <Spinner />
                Memuat...
              </div>
            </div>
          )}
        </>
      )}
    </SectionErrorBoundary>
  );
}
