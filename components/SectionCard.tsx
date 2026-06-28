import Link from "next/link";
import { SearchResult, proxyCover } from "@/lib/api";

export default function SectionCard({ item }: { item: SearchResult }) {
  return (
    <Link
      href={`/manga/${item.source}/${encodeURIComponent(item.id)}`}
      className="shrink-0 w-40 rounded-lg bg-(--color-surface) border border-(--color-border) hover:border-(--color-accent) transition-colors duration-150 overflow-hidden"
    >
      <div className="w-full h-50 bg-(--color-bg)">
        {item.cover ? (
          <img
            src={proxyCover(item.cover)}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-(--color-text-muted) text-[10px]">
            No Cover
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="text-[12px] font-medium text-(--color-text) line-clamp-2 leading-tight">
          {item.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {item.chapter && (
            <p className="text-[10px] text-(--color-text-muted)">
              Ch. {item.chapter}
            </p>
          )}
          {item.rating != null && Number(item.rating) > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-500">
              <svg
                width="8"
                height="8"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              {Number(item.rating).toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
