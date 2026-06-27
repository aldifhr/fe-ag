"use client";
import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
// Clerk auth disabled — re-enable when SSL ready
import SearchModal from "@/components/SearchModal";
import { useTheme } from "@/components/ThemeProvider";
import { getFavorites } from "@/lib/favorites";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export default function Nav() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [otherOpen, setOtherOpen] = useState(false);
  const [mobileOtherOpen, setMobileOtherOpen] = useState(false);
  const [favCount, setFavCount] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();

  const isMangaPage = pathname.startsWith("/manga/");

  useEffect(() => {
    setFavCount(getFavorites().length);
  }, []);

  // Refresh count when localStorage changes (other tabs or same-tab updates)
  useEffect(() => {
    function onStorage() {
      setFavCount(getFavorites().length);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Also re-check on route change in case user navigated away after toggling favorite
  useEffect(() => {
    setFavCount(getFavorites().length);
  }, [pathname]);

  // Close desktop "Lainnya" dropdown on outside click or Escape
  useEffect(() => {
    if (!otherOpen) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-other-menu]")) setOtherOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOtherOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [otherOpen]);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const goBack = useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }, [router]);

  const navLinkClass = (href: string) => {
    const active = isActive(pathname, href);
    return [
      "px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors duration-150 inline-flex items-center gap-1.5",
      active
        ? "text-[var(--color-accent)] bg-[var(--color-accent-dim)]"
        : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]",
    ].join(" ");
  };

  const mobileLinkClass = (href: string) => {
    const active = isActive(pathname, href);
    return [
      "px-4 py-3 text-[15px] font-medium rounded-lg transition-colors duration-150 inline-flex items-center gap-2 w-full",
      active
        ? "text-[var(--color-accent)] bg-[var(--color-accent-dim)]"
        : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]",
    ].join(" ");
  };

  return (
    <>
      <SearchModal open={searchOpen} onClose={closeSearch} />
      <nav className="sticky top-0 z-50 bg-(--color-bg)/95 backdrop-blur-sm border-b border-(--color-border)">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Left group */}
          <div className="flex items-center gap-2">
            {/* Back button — manga pages only */}
            {isMangaPage && (
              <button
                onClick={goBack}
                className="p-2 -ml-2 text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface) rounded-md transition-colors duration-150"
                aria-label="Kembali"
              >
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
                  <path d="M19 12H5" />
                  <path d="m12 19-7-7 7-7" />
                </svg>
              </button>
            )}

            <Link
              href="/"
              className="font-semibold text-[15px] tracking-tight text-(--color-text)"
            >
              Manhwa<span className="text-(--color-accent)">.</span>
            </Link>

            {/* Desktop links */}
            <div className="hidden sm:flex items-center gap-1 ml-4">
              <Link href="/" className={navLinkClass("/")}>
                Beranda
              </Link>
              <Link href="/favorites" className={navLinkClass("/favorites")}>
                Favorit
                {favCount > 0 && (
                  <span className="text-[10px] font-semibold min-w-4.5 h-4.5 px-1 flex items-center justify-center rounded-full bg-(--color-accent) text-white leading-none">
                    {favCount}
                  </span>
                )}
              </Link>
              <Link href="/history" className={navLinkClass("/history")}>
                Riwayat
              </Link>
              <Link href="/genres" className={navLinkClass("/genres")}>
                Genre
              </Link>
              {/* Lainnya dropdown */}
              <div className="relative" data-other-menu>
                <button
                  onClick={() => setOtherOpen((v) => !v)}
                  className={[
                    "px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors duration-150 inline-flex items-center gap-1.5",
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
                    className={`transition-transform duration-200 ${otherOpen ? "rotate-180" : ""}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {otherOpen && (
                  <div className="absolute top-full left-0 mt-1 w-44 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 z-50">
                    <Link
                      href="/stats"
                      onClick={() => setOtherOpen(false)}
                      className={[
                        "px-3 py-2 text-sm flex items-center gap-2",
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
                      onClick={() => setOtherOpen(false)}
                      className={[
                        "px-3 py-2 text-sm flex items-center gap-2",
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
                )}
              </div>
            </div>
          </div>

          {/* Right group */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggle}
              className="p-2 text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface) rounded-md transition-colors duration-150"
              aria-label={
                theme === "dark"
                  ? "Ganti ke mode terang"
                  : "Ganti ke mode gelap"
              }
            >
              {theme === "dark" ? (
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
                  width="18"
                  height="18"
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
            </button>

            {/* Desktop search icon */}
            <button
              onClick={openSearch}
              className="hidden sm:block p-2 text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface) rounded-md transition-colors duration-150"
              aria-label="Cari"
            >
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
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="sm:hidden p-2 text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface) rounded-md transition-colors duration-150"
              aria-label="Menu"
            >
              {menuOpen ? (
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
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
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
            <Link
              href="/history"
              onClick={closeMenu}
              className={mobileLinkClass("/history")}
            >
              Riwayat
            </Link>
            <Link
              href="/genres"
              onClick={closeMenu}
              className={mobileLinkClass("/genres")}
            >
              Genre
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
      </nav>
    </>
  );
}
