import Link from "next/link";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";

const FEATURED_SLUGS = [
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
];

export default function GenrePopuler({
  genres,
}: {
  genres: { slug: string; name: string }[] | undefined;
}) {
  if (!genres || genres.length === 0) return null;
  return (
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
          {genres
            .filter((g) => FEATURED_SLUGS.includes(g.slug))
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
  );
}
