import Link from "next/link";

interface ReaderBottomNavProps {
  loading: boolean;
  error: string | null;
  images: string[];
  chromeHidden: boolean;
  chapterNum: string;
  mangaHref: string;
  prevChapter: { id: string | number; number: string | number } | null;
  nextChapter: { id: string | number; number: string | number } | null;
  buildChapterUrl: (ch: { number: string | number; id: string | number }) => string;
}

export function ReaderBottomNav({
  loading,
  error,
  images,
  chromeHidden,
  chapterNum,
  mangaHref,
  prevChapter,
  nextChapter,
  buildChapterUrl,
}: ReaderBottomNavProps) {
  if (loading || error || images.length === 0) return null;

  return (
    <div className={`transition-opacity duration-300 ${chromeHidden ? "opacity-0 pointer-events-none" : ""}`}>
      {/* Gradient fade from content to footer */}
      <div className="h-24 bg-linear-to-b from-transparent to-bg" />

      <div className="w-full border-t border-border bg-surface">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-6 py-10 px-4">
          <p className="text-sm font-semibold text-text tracking-wide uppercase">
            Chapter {chapterNum} selesai
          </p>

          <Link
            href={mangaHref}
            className="flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-hover transition-colors duration-150 hover:underline underline-offset-4 decoration-accent"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
            Kembali ke Detail
          </Link>

          {/* Prev / Next */}
          <div className="flex items-center gap-3">
            {prevChapter ? (
              <Link
                href={buildChapterUrl(prevChapter)}
                className="px-5 py-2.5 text-[13px] font-medium rounded-lg bg-bg border border-border text-text-secondary hover:text-text hover:border-border-hover transition-all duration-150"
              >
                &larr; Prev
              </Link>
            ) : (
              <span className="px-5 py-2.5 text-[13px] font-medium rounded-lg bg-bg border border-border text-text-muted opacity-40 cursor-not-allowed select-none pointer-events-none">
                &larr; Prev
              </span>
            )}
            {nextChapter ? (
              <Link
                href={buildChapterUrl(nextChapter)}
                className="px-5 py-2.5 text-[13px] font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-all duration-150 shadow-md"
              >
                Next &rarr;
              </Link>
            ) : (
              <span className="px-5 py-2.5 text-[13px] font-medium rounded-lg bg-accent text-white opacity-40 cursor-not-allowed select-none pointer-events-none">
                Next &rarr;
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
