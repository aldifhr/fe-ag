import { SearchResult } from "@/lib/api";
import MangaCard from "@/components/MangaCard";

type Props = {
  loading: boolean;
  error: string | null;
  results: SearchResult[];
  hasSearched: boolean;
  showEmpty: boolean;
  showPlaceholder: boolean;
  debouncedQuery: string;
  refetch: () => void;
};

export default function SearchResults({
  loading,
  error,
  results,
  hasSearched,
  showEmpty,
  showPlaceholder,
  debouncedQuery,
  refetch,
}: Props) {
  return (
    <>
      {/* Results count */}
      {hasSearched && !loading && !error && (
        <p className="text-[13px] text-(--color-text-muted)">
          {results.length} hasil untuk &lsquo;{debouncedQuery}&rsquo;
        </p>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex flex-col">
              <div className="skeleton aspect-3/4 w-full rounded-lg" />
              <div className="mt-2 space-y-1.5 px-0.5">
                <div className="skeleton h-3.5 w-3/4 rounded" />
                <div className="skeleton h-3 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="text-center py-20">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-(--color-surface) border border-(--color-border) flex items-center justify-center">
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
          <p className="text-sm text-(--color-text-secondary) mb-3">{error}</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 text-[13px] font-medium rounded-lg bg-(--color-surface) border border-(--color-border) text-(--color-text-secondary) hover:text-(--color-text) hover:border-(--color-border-hover) transition-colors duration-150"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Results */}
      {!loading && !error && results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {results.map((item, i) => (
            <MangaCard
              key={`${item.source}-${item.id}-${i}`}
              title={item.title}
              cover={item.cover}
              source={item.source}
              id={item.id}
              time={item.time}
              status={item.status}
              rating={item.rating}
            />
          ))}
        </div>
      )}

      {/* Empty — no results */}
      {showEmpty && (
        <div className="text-center py-20">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-(--color-surface) border border-(--color-border) flex items-center justify-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-text-muted)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
              <path d="M8 11h6" />
            </svg>
          </div>
          <p className="text-(--color-text-secondary)">
            Tidak ditemukan hasil untuk &lsquo;{debouncedQuery}&rsquo;
          </p>
        </div>
      )}

      {/* Placeholder — no query yet */}
      {showPlaceholder && (
        <div className="text-center py-20">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-(--color-surface) border border-(--color-border) flex items-center justify-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-text-muted)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <p className="text-(--color-text-secondary)">
            Ketik judul manhwa untuk mulai mencari
          </p>
        </div>
      )}
    </>
  );
}
