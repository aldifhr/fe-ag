"use client";

import SectionErrorBoundary from "@/components/SectionErrorBoundary";

export default function HeroSection() {
  return (
    <SectionErrorBoundary>
      <button
        onClick={() =>
          window.dispatchEvent(new Event("open-search"))
        }
        className="flex items-center gap-2.5 h-10 px-3.5 rounded-lg bg-(--color-surface) border border-(--color-border) text-(--color-text-muted) text-[13px] text-left transition-colors duration-150 hover:border-(--color-border-hover) cursor-text"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-50">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <span>Cari manga favoritmu...</span>
      </button>
    </SectionErrorBoundary>
  );
}
