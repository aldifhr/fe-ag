import Link from "next/link";
import { markAsRead, unmarkAsRead, timeAgo } from "@/lib/history";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";

// ponytail: exact chapter shape from MangaDetail type; widen when API changes
type ChapterItem = {
  id: string | number;
  number: string | number;
  title: string;
  url: string;
  createdAt: string | null;
};

interface ChapterListProps {
  source: string;
  id: string;
  mangaTitle: string;
  mangaCover: string | null;
  mangaSource: string;
  mangaUrl: string | null;
  filteredChapters: ChapterItem[];
  sortedChapters: ChapterItem[];
  lastRead: number | null;
  chapterSearch: string;
  setChapterSearch: (v: string) => void;
  chapterSort: "desc" | "asc";
  setChapterSort: React.Dispatch<React.SetStateAction<"desc" | "asc">>;
  chapterPage: number;
  setChapterPage: React.Dispatch<React.SetStateAction<number>>;
  chapterJump: string;
  setChapterJump: (v: string) => void;
  jumpError: string | null;
  setJumpError: (v: string | null) => void;
  readChapters: Set<string>;
  setReadChapters: React.Dispatch<React.SetStateAction<Set<string>>>;
  showAllChapters: boolean;
  setShowAllChapters: (v: boolean) => void;
}

const CHAPTERS_PER_PAGE = 10;

export function ChapterList({
  source,
  id,
  mangaTitle,
  mangaCover,
  mangaSource,
  mangaUrl,
  filteredChapters,
  sortedChapters,
  lastRead,
  chapterSearch,
  setChapterSearch,
  chapterSort,
  setChapterSort,
  chapterPage,
  setChapterPage,
  chapterJump,
  setChapterJump,
  jumpError,
  setJumpError,
  readChapters,
  setReadChapters,
  showAllChapters,
  setShowAllChapters,
}: ChapterListProps) {
  const visibleChapters = showAllChapters
    ? filteredChapters
    : filteredChapters.slice(0, 100);

  return (
    <SectionErrorBoundary>
      <div>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          Chapter{" "}
          <span className="text-(--color-text-muted) font-normal">
            ({filteredChapters.length})
          </span>
          <span className="text-(--color-text-muted)">·</span>
          <button
            onClick={() => {
              setChapterSort((p) => (p === "desc" ? "asc" : "desc"));
              setChapterPage(1);
            }}
            className="text-[12px] text-(--color-accent) font-medium hover:text-(--color-accent-hover) cursor-pointer"
          >
            {chapterSort === "desc" ? "↑ Terlama" : "↓ Terbaru"}
          </button>
        </h2>

        {/* Chapter search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Cari chapter..."
            value={chapterSearch}
            onChange={(e) => setChapterSearch(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg bg-(--color-bg) border border-(--color-border) text-(--color-text) placeholder-(--color-text-muted) focus:outline-none focus:border-(--color-accent) transition-colors"
          />
        </div>

        {/* Lanjut dari Chapter X banner */}
        {lastRead !== null &&
          sortedChapters.length > 0 &&
          (() => {
            const matchCh = sortedChapters.find(
              (ch) => ch.number === lastRead,
            );
            if (!matchCh) return null;
            return (
              <Link
                href={`/manga/${source}/${encodeURIComponent(id)}/${lastRead}`}
                onClick={() => {
                  try {
                    localStorage.setItem(
                      `manhwa-meta-${source}-${id}-${lastRead}`,
                      JSON.stringify({
                        baseUrl: mangaUrl || "",
                        chapterId: String(matchCh.id || ""),
                      }),
                    );
                  } catch {}
                }}
                className="flex items-center gap-3 bg-(--color-accent)/10 border border-(--color-accent)/20 rounded-lg px-4 py-3 mb-4 group transition-colors hover:bg-(--color-accent)/15"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polygon
                    points="10 8 16 12 10 16 10 8"
                    fill="var(--color-accent)"
                    stroke="var(--color-accent)"
                  />
                </svg>
                <span className="flex-1 text-[13px] font-semibold text-(--color-accent)">
                  Lanjutkan dari Chapter {lastRead}
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            );
          })()}

        {filteredChapters.length === 0 ? (
          <p className="text-(--color-text-muted) py-10 text-center text-[13px]">
            Belum ada chapter tersedia.
          </p>
        ) : (
          <>
            {/* Chapter jump input */}
            <div className="flex items-center gap-2 mb-3">
              <input
                type="number"
                placeholder="Loncat ke chapter..."
                value={chapterJump}
                onChange={(e) => {
                  setChapterJump(e.target.value);
                  setJumpError(null);
                }}
                onFocus={() => setJumpError(null)}
                className="w-24 px-2.5 py-1.5 text-[12px] rounded border border-(--color-border) bg-(--color-bg) text-(--color-text) focus:border-(--color-accent) outline-none transition-colors"
              />
              <button
                onClick={() => {
                  const num = parseFloat(chapterJump);
                  if (isNaN(num)) {
                    setJumpError("Masukkan nomor chapter");
                    return;
                  }
                  const idx = sortedChapters.findIndex(
                    (ch) => ch.number === num,
                  );
                  if (idx === -1) {
                    setJumpError("Chapter tidak ditemukan");
                    return;
                  }
                  const targetPage = Math.floor(idx / CHAPTERS_PER_PAGE) + 1;
                  setChapterPage(targetPage);
                  requestAnimationFrame(() => {
                    document
                      .getElementById(`chapter-${num}`)
                      ?.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                  });
                }}
                className="text-[12px] text-(--color-accent) font-medium hover:text-(--color-accent-hover) cursor-pointer"
              >
                Loncat
              </button>
              {jumpError && (
                <span className="text-[11px] text-(--color-danger)">
                  {jumpError}
                </span>
              )}
            </div>

            <div className="flex flex-col">
              {visibleChapters
                .slice(
                  (chapterPage - 1) * CHAPTERS_PER_PAGE,
                  chapterPage * CHAPTERS_PER_PAGE,
                )
                .map((ch) => (
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
                ))}
            </div>

            {/* Pagination */}
            {Math.ceil(visibleChapters.length / CHAPTERS_PER_PAGE) > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4 pt-4">
                <button
                  onClick={() => setChapterPage((p) => Math.max(1, p - 1))}
                  disabled={chapterPage === 1}
                  className="px-3 py-1.5 text-[12px] font-medium rounded border border-(--color-border) bg-(--color-surface) text-(--color-text-secondary) hover:border-(--color-border-hover) hover:text-(--color-text) disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  &laquo; Prev
                </button>
                <span className="text-[12px] text-(--color-text-muted) tabular-nums">
                  {chapterPage} /{" "}
                  {Math.ceil(visibleChapters.length / CHAPTERS_PER_PAGE)}
                </span>
                <button
                  onClick={() =>
                    setChapterPage((p) =>
                      Math.min(
                        Math.ceil(visibleChapters.length / CHAPTERS_PER_PAGE),
                        p + 1,
                      ),
                    )
                  }
                  disabled={
                    chapterPage ===
                    Math.ceil(visibleChapters.length / CHAPTERS_PER_PAGE)
                  }
                  className="px-3 py-1.5 text-[12px] font-medium rounded border border-(--color-border) bg-(--color-surface) text-(--color-text-secondary) hover:border-(--color-border-hover) hover:text-(--color-text) disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next &raquo;
                </button>
              </div>
            )}

            {/* Tampilkan Semua button */}
            {!showAllChapters && filteredChapters.length > 100 && (
              <button
                onClick={() => setShowAllChapters(true)}
                className="w-full py-3 mt-2 text-sm font-medium text-(--color-accent) bg-(--color-bg) border border-(--color-border) rounded-lg hover:bg-(--color-surface) transition-colors cursor-pointer"
              >
                Tampilkan Semua ({filteredChapters.length} chapter)
              </button>
            )}
          </>
        )}
      </div>
    </SectionErrorBoundary>
  );
}
