"use client";

import SectionErrorBoundary from "@/components/SectionErrorBoundary";

export default function HeroSection({
  onRandom,
  randomLoading,
}: {
  onRandom: () => void;
  randomLoading: boolean;
}) {
  return (
    <SectionErrorBoundary>
      <div className="flex items-center gap-2">
        <button
          onClick={() =>
            window.dispatchEvent(new Event("open-search"))
          }
          className="flex-1 flex items-center gap-2.5 h-10 px-3.5 rounded-lg bg-(--color-surface) border border-(--color-border) text-(--color-text-muted) text-[13px] text-left transition-colors duration-150 hover:border-(--color-border-hover) cursor-text"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-50">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <span>Cari manga favoritmu...</span>
        </button>
        <button
          onClick={onRandom}
          disabled={randomLoading}
          className="flex items-center gap-1.5 h-10 px-3.5 rounded-lg bg-(--color-accent) text-[13px] font-medium text-(--color-bg) transition-colors duration-150 hover:opacity-90 disabled:opacity-50 shrink-0"
        >
          {randomLoading ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 3 21 3 21 8" />
              <line x1="4" y1="20" x2="21" y2="3" />
              <polyline points="21 16 21 21 16 21" />
              <line x1="15" y1="15" x2="21" y2="21" />
              <line x1="4" y1="4" x2="9" y2="9" />
            </svg>
          )}
          <span className="hidden sm:inline">Acak</span>
        </button>
      </div>
    </SectionErrorBoundary>
  );
}
