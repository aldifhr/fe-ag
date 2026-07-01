import type React from "react";
import Link from "next/link";
import IncidentBadge from "./IncidentBadge";
interface NavDesktopProps {
  isMangaPage: boolean;
  pathname: string;
  theme: string;
  toggle: () => void;
  otherOpen: boolean;
  setOtherOpen: React.Dispatch<React.SetStateAction<boolean>>;
  menuOpen: boolean;
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  goBack: () => void;
  navLinkClass: (href: string) => string;
  isActive: (pathname: string, href: string) => boolean;
}

export default function NavDesktop({
  isMangaPage,
  goBack,
  theme,
  toggle,
  menuOpen,
  setMenuOpen,
  navLinkClass,
}: NavDesktopProps) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
      {/* Left group */}
      <div className="flex items-center gap-2">
        {isMangaPage && (
          <button onClick={goBack} className="p-2 -ml-2 text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface) rounded-md transition-colors duration-150" aria-label="Back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
            </svg>
          </button>
        )}
        <Link href="/" className="font-semibold text-[15px] tracking-tight text-(--color-text)">
          Dashboard<span className="text-(--color-accent)">.</span>
        </Link>
        <div className="hidden sm:flex items-center gap-1 ml-4">
          <Link href="/" className={navLinkClass("/")}>Home</Link>
          <Link href="/whitelist" className={navLinkClass("/whitelist")}>Whitelist</Link>
          <Link href="/stats" className={navLinkClass("/stats")}>Stats</Link>
          <Link href="/dashboard" className={navLinkClass("/dashboard")}>Status</Link>
          <Link href="/incidents" className={navLinkClass("/incidents")}>
            <span className="relative">
              Incident
              <IncidentBadge />
            </span>
          </Link>
          <Link href="/logs" className={navLinkClass("/logs")}>Logs</Link>
        </div>
      </div>
      <div className="flex items-center gap-2">

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="p-2 text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface) rounded-md transition-colors duration-150"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="sm:hidden p-2 text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface) rounded-md transition-colors duration-150"
          aria-label="Menu"
        >
          {menuOpen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
