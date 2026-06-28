import { SearchResult } from "@/lib/api";
import MangaCard from "@/components/MangaCard";
import ErrorState from "@/components/ErrorState";
import EmptyState from "@/components/EmptyState";
import SkeletonGrid from "@/components/SkeletonGrid";
import { GRID_CLASS } from "@/lib/gridClass";

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
        <SkeletonGrid variant="grid" />
      )}

      {/* Error */}
      {!loading && error && (
        <ErrorState message={error} onRetry={() => refetch()} />
      )}

      {/* Results */}
      {!loading && !error && results.length > 0 && (
        <div className={GRID_CLASS}>
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
              country={item.country}
            />
          ))}
        </div>
      )}

      {/* Empty — no results */}
      {showEmpty && (
        <EmptyState
          title={`Tidak ditemukan hasil untuk \u2018${debouncedQuery}\u2019`}
        />
      )}

      {/* Placeholder — no query yet */}
      {showPlaceholder && (
        <EmptyState title="Ketik judul manhwa untuk mulai mencari" />
      )}
    </>
  );
}
