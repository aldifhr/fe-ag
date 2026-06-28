import Link from "next/link";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";

export default function GenreChips({
  genres,
}: {
  genres: { slug: string; name: string }[];
}) {
  if (genres.length === 0) return null;

  return (
    <SectionErrorBoundary>
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-(--color-text-muted)">
          Genre
        </h2>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
          {genres.map((g) => (
            <Link
              key={g.slug}
              href={`/genres/${g.slug}`}
              className="shrink-0 px-3 py-1.5 rounded-full text-[11px] bg-(--color-surface) border border-(--color-border) text-(--color-text) transition-colors duration-150 hover:bg-(--color-accent)/10 hover:text-(--color-accent) hover:border-(--color-accent)/30"
            >
              {g.name}
            </Link>
          ))}
        </div>
      </div>
    </SectionErrorBoundary>
  );
}
