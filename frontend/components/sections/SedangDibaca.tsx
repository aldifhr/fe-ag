import Link from "next/link";
import { proxyCover } from "@/lib/api";
import { timeAgo, GroupedHistory } from "@/lib/history";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";

export default function SedangDibaca({
  history,
}: {
  history: GroupedHistory[];
}) {
  return (
    <SectionErrorBoundary>
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-(--color-text-muted)">
          Sedang Dibaca
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
          {history.map((h) => {
            const latest = Math.max(...h.chapters);
            const pct = h.totalChapters
              ? Math.min(100, (latest / h.totalChapters) * 100)
              : null;
            return (
              <Link
                key={h.mangaId}
                href={`/manga/${h.source}/${encodeURIComponent(h.mangaId)}/${latest}`}
                className="shrink-0 w-28 rounded-lg bg-(--color-surface) border border-(--color-border) hover:border-(--color-accent) transition-colors duration-150 overflow-hidden"
              >
                <div className="w-full h-38 bg-(--color-bg)">
                  {h.cover ? (
                    <img
                      src={proxyCover(h.cover)}
                      alt={h.title}
                      className="w-full h-full object-cover rounded-t"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-(--color-text-muted) text-[9px]">
                      No Cover
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-[12px] font-medium text-(--color-text) line-clamp-1">
                    {h.title}
                  </p>
                  <p className="text-[10px] text-(--color-text-muted) mt-0.5">
                    {h.totalChapters
                      ? `Chapter ${latest} / ${h.totalChapters}`
                      : `Chapter ${latest}`}
                  </p>
                  {pct !== null && (
                    <div className="mt-1 h-1 rounded-full bg-(--color-surface)">
                      <div
                        className="h-1 rounded-full bg-(--color-accent)"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                  <p className="text-[9px] text-(--color-text-muted) mt-1">
                    {timeAgo(h.latestReadAt)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </SectionErrorBoundary>
  );
}
