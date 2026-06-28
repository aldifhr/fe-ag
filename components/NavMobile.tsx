import type React from "react";
import Link from "next/link";

interface NavMobileProps {
  isMangaPage: boolean;
  menuOpen: boolean;
  mobileOtherOpen: boolean;
  setMobileOtherOpen: React.Dispatch<React.SetStateAction<boolean>>;
  pathname: string;
  favCount: number;
  theme: string;
  toggle: () => void;
  closeMenu: () => void;
  goBack: () => void;
  mobileLinkClass: (href: string) => string;
  isActive: (pathname: string, href: string) => boolean;
}

export default function NavMobile({
  isMangaPage,
  menuOpen,
  mobileOtherOpen,
  setMobileOtherOpen,
  pathname,
  favCount,
  theme,
  toggle,
  closeMenu,
  goBack,
  mobileLinkClass,
  isActive,
}: NavMobileProps) {
  return (
    <div
      className={`sm:hidden overflow-hidden transition-[max-height] duration-300 ease-in-out border-b border-(--color-border) ${
        menuOpen ? "max-h-[28rem]" : "max-h-0 border-b-0"
      }`}
    >
      <div className="px-4 py-2 flex flex-col gap-1 bg-(--color-bg)">
        {isMangaPage && (
          <button
            onClick={() => {
              goBack();
              closeMenu();
            }}
            className="px-4 py-3 text-[15px] font-medium text-(--color-text-secondary) hover:text-(--color-text) hover:bg-(--color-surface) rounded-lg transition-colors duration-150 inline-flex items-center gap-2 w-full"
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
              <path d="m12 19-7-7 7-7" />
            </svg>
            Kembali
          </button>
        )}
        <Link href="/" onClick={closeMenu} className={mobileLinkClass("/")}>
          Beranda
        </Link>
        <Link
          href="/latest"
          onClick={closeMenu}
          className={mobileLinkClass("/latest")}
        >
          Terbaru
        </Link>
        <Link
          href="/genres"
          onClick={closeMenu}
          className={mobileLinkClass("/genres")}
        >
          Genre
        </Link>
        <Link
          href="/search"
          onClick={closeMenu}
          className={mobileLinkClass("/search")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          Cari
        </Link>
        <Link
          href="/favorites"
          onClick={closeMenu}
          className={mobileLinkClass("/favorites")}
        >
          Favorit
          {favCount > 0 && (
            <span className="text-[10px] font-semibold min-w-4.5 h-4.5 px-1 flex items-center justify-center rounded-full bg-(--color-accent) text-white leading-none">
              {favCount}
            </span>
          )}
        </Link>
        {/* Lainnya collapsible */}
        <div>
          <button
            onClick={() => setMobileOtherOpen((v) => !v)}
            className={[
              "px-4 py-3 text-[15px] font-medium rounded-lg transition-colors duration-150 inline-flex items-center gap-2 w-full justify-between",
              isActive(pathname, "/stats") || isActive(pathname, "/leaderboard")
                ? "text-[var(--color-accent)] bg-[var(--color-accent-dim)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]",
            ].join(" ")}
          >
            Lainnya
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform duration-200 ${mobileOtherOpen ? "rotate-180" : ""}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <div
            className={`overflow-hidden transition-[max-height] duration-200 ease-in-out ${
              mobileOtherOpen ? "max-h-48" : "max-h-0"
            }`}
          >
            <div className="pl-4 flex flex-col gap-1 py-1">
              <Link
                href="/history"
                onClick={closeMenu}
                className={[
                  "px-4 py-2 text-[13px] font-medium rounded-lg transition-colors duration-150 inline-flex items-center gap-2 w-full",
                  isActive(pathname, "/history")
                    ? "text-[var(--color-accent)] bg-[var(--color-accent-dim)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]",
                ].join(" ")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Riwayat
              </Link>
              <Link
                href="/stats"
                onClick={closeMenu}
                className={[
                  "px-4 py-2 text-[13px] font-medium rounded-lg transition-colors duration-150 inline-flex items-center gap-2 w-full",
                  isActive(pathname, "/stats")
                    ? "text-[var(--color-accent)] bg-[var(--color-accent-dim)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]",
                ].join(" ")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
                Statistik
              </Link>
              <Link
                href="/leaderboard"
                onClick={closeMenu}
                className={[
                  "px-4 py-2 text-[13px] font-medium rounded-lg transition-colors duration-150 inline-flex items-center gap-2 w-full",
                  isActive(pathname, "/leaderboard")
                    ? "text-[var(--color-accent)] bg-[var(--color-accent-dim)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]",
                ].join(" ")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                  <path d="M4 22h16" />
                  <path d="M10 22V8a4 4 0 0 1 4-4h0a4 4 0 0 1 4 4v14" />
                  <path d="M6 22V8a4 4 0 0 0-4-4h0a4 4 0 0 0-4 4v14" />
                </svg>
                Leaderboard
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-(--color-border) mt-1 pt-1">
          <button
            onClick={() => {
              toggle();
              closeMenu();
            }}
            className="px-4 py-3 text-[15px] font-medium text-(--color-text-secondary) hover:text-(--color-text) hover:bg-(--color-surface) rounded-lg transition-colors duration-150 inline-flex items-center gap-2 w-full"
          >
            {theme === "dark" ? (
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
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
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
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
            {theme === "dark" ? "Mode Terang" : "Mode Gelap"}
          </button>
        </div>
      </div>
    </div>
  );
}
