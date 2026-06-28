import Link from "next/link";

interface ContinueReadingCTAProps {
  continueReading: { mangaId: string; chapterNumber: number } | null;
  source: string;
  id: string;
}

export function ContinueReadingCTA({ continueReading, source, id }: ContinueReadingCTAProps) {
  if (!continueReading || continueReading.mangaId !== id) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
      <Link
        href={`/manga/${source}/${encodeURIComponent(id)}/${continueReading.chapterNumber}`}
        className="flex items-center gap-2 px-5 py-3 rounded-full bg-(--color-accent) text-white font-medium text-sm shadow-lg shadow-(--color-accent-dim) hover:bg-(--color-accent-hover) transition-all duration-150"
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
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
        Lanjutkan Baca — Chapter {continueReading.chapterNumber}
      </Link>
    </div>
  );
}
