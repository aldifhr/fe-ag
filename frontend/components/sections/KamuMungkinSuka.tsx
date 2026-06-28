import { SearchResult } from "@/lib/api";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import SectionCard from "@/components/SectionCard";

export default function KamuMungkinSuka({
  items,
  isLoading,
  hasHistory,
}: {
  items: SearchResult[] | undefined;
  isLoading: boolean;
  hasHistory: boolean;
}) {
  const hasData = items && items.length > 0;
  if (!hasData && !isLoading) return null;

  return (
    <SectionErrorBoundary>
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-(--color-text-muted)">
          Kamu Mungkin Suka
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
          {hasData
            ? items!.map((item, i) => (
                <SectionCard key={`rec-${item.id}-${i}`} item={item} />
              ))
            : /* Loading skeleton */
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="shrink-0 w-40 rounded-lg bg-(--color-surface) border border-(--color-border) overflow-hidden"
                >
                  <div className="w-full h-50 skeleton" />
                  <div className="p-2 space-y-2">
                    <div className="skeleton h-3 w-2/3 rounded" />
                    <div className="skeleton h-2.5 w-1/2 rounded" />
                  </div>
                </div>
              ))}
        </div>
      </div>
    </SectionErrorBoundary>
  );
}
