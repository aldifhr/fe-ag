import Link from "next/link";
import type React from "react";

interface ReaderHeaderProps {
  mangaHref: string;
  chapterNum: string;
  chromeHidden: boolean;
  bgColor: "default" | "dark" | "sepia" | "white";
  setBgColor: (v: "default" | "dark" | "sepia" | "white") => void;
  brightness: number;
  setBrightness: (v: number) => void;
  nightMode: boolean;
  setNightMode: React.Dispatch<React.SetStateAction<boolean>>;
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  settingsRef: React.RefObject<HTMLDivElement | null>;
  scrollProgress: number;
  mangaTitle: string | null;
}

export function ReaderHeader({
  mangaHref,
  chapterNum,
  chromeHidden,
  bgColor,
  setBgColor,
  brightness,
  setBrightness,
  nightMode,
  setNightMode,
  settingsOpen,
  setSettingsOpen,
  settingsRef,
  scrollProgress,
  mangaTitle,
}: ReaderHeaderProps) {
  return (
    <>
      {/* Top bar */}
      <header className={`sticky top-0 z-50 bg-bg/95 backdrop-blur-sm border-b border-border transition-opacity duration-300 ${chromeHidden ? "opacity-0 pointer-events-none" : ""}`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-2.5">
          <Link
            href={mangaHref}
            className="flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-text transition-colors duration-150"
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
            <span className="hidden sm:inline">Kembali</span>
          </Link>

          <span className="text-[13px] font-semibold text-text select-none">
            Chapter {chapterNum}
          </span>

          <div className="flex items-center gap-1.5">
            {/* Reading settings */}
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                className="flex items-center justify-center w-7 h-7 rounded-md text-text-muted hover:text-text-secondary border border-transparent hover:border-border transition-colors duration-150 cursor-pointer"
                aria-label="Pengaturan bacaan"
              >
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
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
              {settingsOpen && (
                <div className="absolute right-0 top-full mt-2 bg-surface border border-border rounded-lg p-3 shadow-lg z-50 w-56">
                  <p className="text-[11px] text-text-muted font-medium uppercase tracking-wider mb-2">
                    Latar Belakang
                  </p>
                  <div className="flex gap-2 mb-3">
                    {[
                      { key: "default" as const, color: "var(--color-bg)" },
                      { key: "dark" as const, color: "#000000" },
                      { key: "sepia" as const, color: "#d4c5a0" },
                      { key: "white" as const, color: "#ffffff" },
                    ].map(({ key, color }) => (
                      <button
                        key={key}
                        onClick={() => setBgColor(key)}
                        className={`w-6 h-6 rounded-full border-2 transition-all duration-150 cursor-pointer ${
                          bgColor === key
                            ? "border-accent"
                            : "border-transparent"
                        } ${key === "white" ? "ring-1 ring-border" : ""}`}
                        style={{ backgroundColor: color }}
                        aria-label={`Latar ${key}`}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-text-muted font-medium uppercase tracking-wider mb-2">
                    Kecerahan: {Math.round(brightness * 100)}%
                  </p>
                  <input
                    type="range"
                    min={50}
                    max={100}
                    step={5}
                    value={Math.round(brightness * 100)}
                    onChange={(e) =>
                      setBrightness(Number(e.target.value) / 100)
                    }
                    className="w-full accent-accent"
                  />
                  <p className="text-[11px] text-text-muted font-medium uppercase tracking-wider mb-2 mt-3">
                    Mode Malam
                  </p>
                  <button
                    onClick={() => setNightMode(!nightMode)}
                    className={`w-full px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors duration-150 cursor-pointer ${
                      nightMode
                        ? "bg-accent text-white"
                        : "bg-surface-hover text-text-muted hover:text-text"
                    }`}
                  >
                    {nightMode ? "✓ Aktif" : "Aktifkan"}
                  </button>
                </div>
              )}
            </div>

            {/* Keyboard shortcut hint */}
            <div className="group relative hidden sm:block">
              <button
                className="flex items-center justify-center w-6 h-6 rounded-md text-text-muted hover:text-text-secondary transition-colors duration-150 cursor-default"
                tabIndex={-1}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <path d="M12 17h.01" />
                </svg>
              </button>
              <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute right-0 top-full mt-1 w-max px-3 py-1.5 rounded-md bg-surface border border-border shadow-lg text-[10px] text-text-muted whitespace-nowrap z-50">
                ← → prev/next chapter · ↑ ↓ scroll gambar · Space scroll ke
                bawah
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* Reading progress bar */}
      <div className={`h-0.5 bg-transparent transition-opacity duration-300 ${chromeHidden ? "opacity-0 pointer-events-none" : ""}`}>
        <div
          className="h-full bg-accent transition-[width] duration-100"
          style={{
            width: `${scrollProgress}%`,
          }}
        />
      </div>

      {/* Breadcrumb */}
      <nav
        className={`max-w-4xl mx-auto px-4 py-2 text-[12px] text-text-muted flex items-center gap-1.5 flex-wrap transition-opacity duration-300 ${chromeHidden ? "opacity-0 pointer-events-none" : ""}`}
        aria-label="Breadcrumb"
      >
        <Link
          href="/"
          className="hover:text-accent transition-colors duration-150"
        >
          Beranda
        </Link>
        <span className="select-none">&gt;</span>
        <Link
          href={mangaHref}
          className="hover:text-accent transition-colors duration-150 line-clamp-1 max-w-50 sm:max-w-none"
        >
          {mangaTitle ?? "..."}
        </Link>
        <span className="select-none">&gt;</span>
        <span className="text-text-secondary">Chapter {chapterNum}</span>
      </nav>
    </>
  );
}
