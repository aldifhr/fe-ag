import Link from "next/link";
import { SearchResult } from "@/lib/api";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import SectionCard from "@/components/SectionCard";

export default function BaruDiupdate({
  items,
}: {
  items: SearchResult[] | undefined;
}) {
  if (!items || items.length === 0) return <></>;
  return (
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
          {items.slice(0, 6).map((item, i) => (
            <SectionCard key={`upd-${item.id}-${i}`} item={item} />
          ))}
        </div>
      </div>
    </SectionErrorBoundary>
  );
}
