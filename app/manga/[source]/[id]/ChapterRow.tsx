import Link from "next/link";
import { markAsRead, unmarkAsRead, timeAgo } from "@/lib/history";

// ponytail: exact chapter shape from MangaDetail type; widen when API changes
type ChapterItem = {
  id: string | number;
  number: string | number;
  title: string;
  url: string;
  createdAt: string | null;
};

interface ChapterRowProps {
  ch: ChapterItem;
  source: string;
  id: string;
  mangaUrl: string | null;
  mangaTitle: string;
  mangaCover: string | null;
  mangaSource: string;
  readChapters: Set<string>;
  setReadChapters: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export function ChapterRow({
  ch,
  source,
  id,
  mangaUrl,
  mangaTitle,
  mangaCover,
  mangaSource,
  readChapters,
  setReadChapters,
}: ChapterRowProps) {
  return (
    <Link
      key={`${ch.id}`}
      id={`chapter-${ch.number}`}
      href={`/manga/${source}/${encodeURIComponent(id)}/${ch.number}`}
      onClick={() => {
        try {
          localStorage.setItem(
            `manhwa-meta-${source}-${id}-${ch.number}`,
            JSON.stringify({
              baseUrl: mangaUrl || "",
              chapterId: String(ch.id || ""),
            }),
          );
        } catch {}
      }}
      className="flex items-center justify-between px-4 py-3 border-b border-(--color-border) hover:bg-(--color-surface) transition-colors duration-150 group"
    >
      <div className="min-w-0 flex items-center gap-1.5">
        {/* Mark as read checkbox */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
            const chNum = String(ch.number);
            if (readChapters.has(chNum)) {
              unmarkAsRead(id, Number(ch.number));
            } else {
              markAsRead(
                id,
                mangaTitle,
                mangaCover,
                mangaSource,
                Number(ch.number),
              );
            }
            setReadChapters((prev) => {
              const next = new Set(prev);
              if (next.has(chNum)) {
                next.delete(chNum);
              } else {
                next.add(chNum);
              }
              return next;
            });
          }}
          className="p-1 rounded hover:bg-(--color-surface) transition-colors shrink-0"
          aria-label={
            readChapters.has(String(ch.number))
              ? "Tandai belum dibaca"
              : "Tandai sudah dibaca"
          }
        >
          {readChapters.has(String(ch.number)) ? (
            <svg
              className="w-4 h-4 text-(--color-accent)"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          ) : (
            <svg
              className="w-4 h-4 text-(--color-text-muted)"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
            </svg>
          )}
        </button>
        {readChapters.has(String(ch.number)) && (
          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
        )}
        <span
          className={`text-[13px] font-medium transition-colors ${readChapters.has(String(ch.number)) ? "text-(--color-text-muted) opacity-60 group-hover:text-(--color-text-secondary)" : "text-(--color-text) group-hover:text-white"}`}
        >
          {String(ch.number).match(/^chapter\s/i)
            ? ch.number
            : `Chapter ${ch.number}`}
        </span>
        {ch.title && ch.title !== `Chapter ${ch.number}` && (
          <span className="text-[13px] text-(--color-text-muted) ml-2">
            {ch.title}
          </span>
        )}
      </div>
      {ch.createdAt && (
        <span className="text-[12px] text-(--color-text-muted) shrink-0 ml-4 tabular-nums text-right">
          <span className="block">{timeAgo(new Date(ch.createdAt).getTime())}</span>
          <span className="block text-[10px] opacity-60">
            {new Date(ch.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </span>
      )}
    </Link>
  );
}
