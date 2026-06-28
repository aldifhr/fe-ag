import Link from "next/link";

interface FloatingBubbleProps {
  chromeHidden: boolean;
  bubblePos: { x: number; y: number } | null;
  bubbleExpanded: boolean;
  setBubbleExpanded: (v: boolean) => void;
  prevChapter: { id: string | number; number: string | number } | null;
  nextChapter: { id: string | number; number: string | number } | null;
  buildChapterUrl: (ch: { number: string | number; id: string | number }) => string;
  scrollToPrevImage: () => void;
  scrollToNextImage: () => void;
  mangaHref: string;
  handleBubblePointerDown: (e: React.PointerEvent) => void;
  handleBubblePointerMove: (e: React.PointerEvent) => void;
  handleBubblePointerUp: () => void;
}

export function FloatingBubble({
  chromeHidden,
  bubblePos,
  bubbleExpanded,
  setBubbleExpanded,
  prevChapter,
  nextChapter,
  buildChapterUrl,
  scrollToPrevImage,
  scrollToNextImage,
  mangaHref,
  handleBubblePointerDown,
  handleBubblePointerMove,
  handleBubblePointerUp,
}: FloatingBubbleProps) {
  return (
    <div
      className={`fixed z-50 select-none transition-opacity duration-300 ${chromeHidden ? "opacity-0 pointer-events-none" : ""}`}
      style={{
        left: bubblePos ? bubblePos.x : "auto",
        right: bubblePos ? "auto" : 24,
        top: bubblePos ? bubblePos.y : "50%",
        transform: bubblePos ? "none" : "translateY(-50%)",
      }}
    >
      {/* Expanded menu */}
      {bubbleExpanded && (
        <div className="absolute bottom-full mb-2 right-0 flex flex-col items-end gap-2 animate-[fadeIn_0.15s_ease]">
          {/* Prev chapter */}
          {prevChapter && (
            <button
              onClick={() => {
                window.location.href = buildChapterUrl(prevChapter);
                setBubbleExpanded(false);
              }}
              className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-surface border border-border shadow-lg text-text-secondary hover:text-text hover:bg-surface-hover transition-colors duration-150 cursor-pointer"
            >
              <span className="text-[11px] font-medium whitespace-nowrap">
                Chapter Prev
              </span>
              <span className="w-7 h-7 rounded-full bg-surface-hover flex items-center justify-center">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 12H5" />
                  <path d="M12 19l-7-7 7-7" />
                </svg>
              </span>
            </button>
          )}
          {/* Next chapter */}
          {nextChapter && (
            <button
              onClick={() => {
                window.location.href = buildChapterUrl(nextChapter);
                setBubbleExpanded(false);
              }}
              className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-surface border border-border shadow-lg text-text-secondary hover:text-text hover:bg-surface-hover transition-colors duration-150 cursor-pointer"
            >
              <span className="text-[11px] font-medium whitespace-nowrap">
                Chapter Next
              </span>
              <span className="w-7 h-7 rounded-full bg-accent-dim flex items-center justify-center text-accent">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </span>
            </button>
          )}
          {/* Scroll up */}
          <button
            onClick={() => {
              scrollToPrevImage();
              setBubbleExpanded(false);
            }}
            className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-surface border border-border shadow-lg text-text-secondary hover:text-text hover:bg-surface-hover transition-colors duration-150 cursor-pointer"
          >
            <span className="text-[11px] font-medium whitespace-nowrap">
              Scroll Atas
            </span>
            <span className="w-7 h-7 rounded-full bg-surface-hover flex items-center justify-center">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 15l-6-6-6 6" />
              </svg>
            </span>
          </button>
          {/* Scroll down */}
          <button
            onClick={() => {
              scrollToNextImage();
              setBubbleExpanded(false);
            }}
            className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-surface border border-border shadow-lg text-text-secondary hover:text-text hover:bg-surface-hover transition-colors duration-150 cursor-pointer"
          >
            <span className="text-[11px] font-medium whitespace-nowrap">
              Scroll Bawah
            </span>
            <span className="w-7 h-7 rounded-full bg-surface-hover flex items-center justify-center">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </button>
          {/* Go to detail */}
          <Link
            href={mangaHref}
            onClick={() => setBubbleExpanded(false)}
            className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-surface border border-border shadow-lg text-text-secondary hover:text-text hover:bg-surface-hover transition-colors duration-150"
          >
            <span className="text-[11px] font-medium whitespace-nowrap">
              Detail
            </span>
            <span className="w-7 h-7 rounded-full bg-accent-dim flex items-center justify-center text-accent">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </span>
          </Link>
        </div>
      )}

      {/* Main bubble button */}
      <div
        className="w-12 h-12 rounded-full bg-surface/90 backdrop-blur-sm border border-border shadow-lg shadow-black/20 flex items-center justify-center text-text-muted hover:text-text hover:border-border-hover transition-colors duration-150 cursor-pointer select-none touch-none"
        style={{ opacity: bubbleExpanded ? 1 : 0.7 }}
        onPointerDown={handleBubblePointerDown}
        onPointerMove={handleBubblePointerMove}
        onPointerUp={handleBubblePointerUp}
      >
        {bubbleExpanded ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        )}
      </div>
    </div>
  );
}
