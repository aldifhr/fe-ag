import type React from "react";
import Link from "next/link";
import IncidentBadge from "./IncidentBadge";
interface NavMobileProps {
  isMangaPage: boolean;
  menuOpen: boolean;
  mobileOtherOpen: boolean;
  setMobileOtherOpen: React.Dispatch<React.SetStateAction<boolean>>;
  pathname: string;
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
  theme,
  toggle,
  closeMenu,
  goBack,
  mobileLinkClass,
}: NavMobileProps) {
  return (
    <div className={`sm:hidden overflow-hidden transition-[max-height] duration-300 ease-in-out border-b border-(--color-border) ${menuOpen ? "max-h-[20rem]" : "max-h-0 border-b-0"}`}>
      <div className="px-4 py-2 flex flex-col gap-1 bg-(--color-bg)">
        {isMangaPage && (
          <button onClick={() => { goBack(); closeMenu(); }} className="px-4 py-3 text-[15px] font-medium text-(--color-text-secondary) hover:text-(--color-text) hover:bg-(--color-surface) rounded-lg transition-colors duration-150 inline-flex items-center gap-2 w-full">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
            </svg>
            Kembali
          </button>
        )}
        <Link href="/" onClick={closeMenu} className={mobileLinkClass("/")}>Beranda</Link>
        <Link href="/whitelist" onClick={closeMenu} className={mobileLinkClass("/whitelist")}>Whitelist</Link>
        <Link href="/stats" onClick={closeMenu} className={mobileLinkClass("/stats")}>Statistik</Link>
        <Link href="/dashboard" onClick={closeMenu} className={mobileLinkClass("/dashboard")}>Status</Link>
        <Link href="/incidents" onClick={closeMenu} className={mobileLinkClass("/incidents")}>
          <span className="relative">
            Insiden
            <IncidentBadge />
          </span>
        </Link>
        <Link href="/logs" onClick={closeMenu} className={mobileLinkClass("/logs")}>Logs</Link>
        <div className="border-t border-(--color-border) mt-1 pt-1">
          <button onClick={() => { toggle(); closeMenu(); }} className="px-4 py-3 text-[15px] font-medium text-(--color-text-secondary) hover:text-(--color-text) hover:bg-(--color-surface) rounded-lg transition-colors duration-150 inline-flex items-center gap-2 w-full">
            {theme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
