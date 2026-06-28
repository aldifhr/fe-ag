import { SearchResult } from "@/lib/api";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import SectionCard from "@/components/SectionCard";

export default function Populer({
  items,
  onSeeAll,
}: {
  items: SearchResult[] | undefined;
  onSeeAll: () => void;
}) {
  if (!items || items.length === 0) return <></>;
  return (
    <SectionErrorBoundary>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-(--color-text-muted)">
            Populer
          </h2>
          <button
            type="button"
            onClick={onSeeAll}
            className="text-[12px] text-(--color-accent) hover:underline cursor-pointer relative z-10"
          >
            Lihat Semua &rarr;
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
          {items.slice(0, 6).map((item, i) => (
            <SectionCard key={`pop-${item.id}-${i}`} item={item} />
          ))}
        </div>
      </div>
    </SectionErrorBoundary>
  );
}
