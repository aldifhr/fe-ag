import MangaCard from "@/components/MangaCard";
import type { SearchResult } from "@/lib/api";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";

export function Serupa({ recommendations }: { recommendations: SearchResult[] }) {
  if (recommendations.length === 0) return null;
  return (
    <SectionErrorBoundary>
      <div className="mt-10">
        <h2 className="text-base font-semibold mb-4">Serupa</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {recommendations.map((m) => (
            <MangaCard
              key={m.id}
              id={m.id}
              title={m.title}
              cover={m.cover}
              source={m.source}
            />
          ))}
        </div>
      </div>
    </SectionErrorBoundary>
  );
}
