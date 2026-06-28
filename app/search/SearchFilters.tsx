import { useState } from "react";
import type { Genre } from "@/lib/api";
import {
  SORT_OPTIONS as SORT_OPTS,
  SOURCE_OPTIONS as SOURCE_OPTS,
} from "@/lib/home-types";

const SORT_OPTIONS = [{ label: "Terbaru", value: "" }, ...SORT_OPTS] as const;

const STATUS_OPTIONS = [
  { label: "Semua", value: "" },
  { label: "Ongoing", value: "ongoing" },
  { label: "Completed", value: "completed" },
  { label: "Hiatus", value: "hiatus" },
  { label: "Cancelled", value: "cancelled" },
] as const;

const SOURCE_OPTIONS = [
  { label: "Semua", value: "" },
  ...SOURCE_OPTS.slice(1),
] as const;

const GENRE_VISIBLE_ROWS = 3;

type Props = {
  sortFilter: string;
  setSortFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  sourceFilter: string;
  setSourceFilter: (v: string) => void;
  genreFilters: string[];
  setGenreFilters: React.Dispatch<React.SetStateAction<string[]>>;
  genres: Genre[];
  genresLoading: boolean;
  hasSearched: boolean;
};

export default function SearchFilters({
  sortFilter,
  setSortFilter,
  statusFilter,
  setStatusFilter,
  sourceFilter,
  setSourceFilter,
  genreFilters,
  setGenreFilters,
  genres,
  genresLoading,
  hasSearched,
}: Props) {
  const [showAllGenres, setShowAllGenres] = useState(false);

  if (!hasSearched) return null;

  const toggleGenre = (slug: string) => {
    setGenreFilters((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const removeGenre = (slug: string) => {
    setGenreFilters((prev) => prev.filter((s) => s !== slug));
  };

  // Build active filter chips
  const activeChips: { label: string; onRemove: () => void }[] = [];
  if (statusFilter) {
    const opt = STATUS_OPTIONS.find((o) => o.value === statusFilter);
    if (opt) activeChips.push({ label: opt.label, onRemove: () => setStatusFilter("") });
  }
  if (sourceFilter) {
    const opt = SOURCE_OPTIONS.find((o) => o.value === sourceFilter);
    if (opt) activeChips.push({ label: opt.label, onRemove: () => setSourceFilter("") });
  }
  for (const slug of genreFilters) {
    const genre = genres.find((g) => g.slug === slug);
    if (genre) {
      activeChips.push({
        label: genre.name,
        onRemove: () => removeGenre(slug),
      });
    }
  }

  const pillClass = (active: boolean) =>
    `px-3 py-1 text-[13px] rounded-full transition-colors duration-150 ${
      active
        ? "bg-(--color-accent) text-white"
        : "bg-(--color-surface) text-(--color-text-muted) border border-(--color-border)"
    }`;

  const genreChipClass = (active: boolean) =>
    `px-2.5 py-0.5 text-xs rounded-full transition-colors duration-150 cursor-pointer select-none ${
      active
        ? "bg-(--color-accent) text-white"
        : "bg-(--color-surface) border border-(--color-border) text-(--color-text-muted)"
    }`;

  return (
    <div className="space-y-3">
      {/* Sort + Status + Source pills */}
      <div className="flex flex-wrap gap-2">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={`sort-${opt.value}`}
            onClick={() => setSortFilter(opt.value)}
            className={pillClass(sortFilter === opt.value)}
          >
            {opt.label}
          </button>
        ))}
        <span className="w-px h-5 self-center bg-(--color-border)" />
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={`status-${opt.value}`}
            onClick={() => setStatusFilter(opt.value)}
            className={pillClass(statusFilter === opt.value)}
          >
            {opt.label}
          </button>
        ))}
        <span className="w-px h-5 self-center bg-(--color-border)" />
        {SOURCE_OPTIONS.map((opt) => (
          <button
            key={`source-${opt.value}`}
            onClick={() => setSourceFilter(opt.value)}
            className={pillClass(sourceFilter === opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Genre chips */}
      {genresLoading ? (
        <div className="flex items-center gap-2 text-xs text-(--color-text-muted)">
          <span>Genre</span>
          <span className="animate-pulse">Memuat genre...</span>
        </div>
      ) : genres.length > 0 ? (
        <div>
          <span className="text-xs text-(--color-text-muted) mr-2">Genre</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {(showAllGenres ? genres : genres.slice(0, GENRE_VISIBLE_ROWS * 8)).map(
              (genre) => (
                <button
                  key={genre.slug}
                  onClick={() => toggleGenre(genre.slug)}
                  className={genreChipClass(genreFilters.includes(genre.slug))}
                >
                  {genre.name}
                </button>
              ),
            )}
            {!showAllGenres && genres.length > GENRE_VISIBLE_ROWS * 8 && (
              <button
                onClick={() => setShowAllGenres(true)}
                className="px-2.5 py-0.5 text-xs rounded-full border border-dashed border-(--color-border) text-(--color-text-muted) hover:border-(--color-accent) hover:text-(--color-accent) transition-colors"
              >
                Tampilkan lebih ({genres.length - GENRE_VISIBLE_ROWS * 8})
              </button>
            )}
            {showAllGenres && genres.length > GENRE_VISIBLE_ROWS * 8 && (
              <button
                onClick={() => setShowAllGenres(false)}
                className="px-2.5 py-0.5 text-xs rounded-full border border-dashed border-(--color-border) text-(--color-text-muted) hover:border-(--color-accent) hover:text-(--color-accent) transition-colors"
              >
                Sembunyikan
              </button>
            )}
          </div>
        </div>
      ) : null}

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeChips.map((chip) => (
            <button
              key={chip.label}
              onClick={chip.onRemove}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs rounded-full bg-(--color-accent)/15 text-(--color-accent) hover:bg-(--color-accent)/25 transition-colors"
            >
              {chip.label}
              <span className="text-[10px] leading-none font-medium">&times;</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
