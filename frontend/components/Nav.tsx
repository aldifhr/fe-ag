"use client";
import { useState, useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
// Clerk auth disabled — re-enable when SSL ready
import SearchModal from "@/components/SearchModal";
import { useTheme } from "@/components/ThemeProvider";
import { getFavorites } from "@/lib/favorites";
import NavDesktop from "@/components/NavDesktop";
import NavMobile from "@/components/NavMobile";

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
        <NavDesktop
          isMangaPage={isMangaPage}
          pathname={pathname}
          theme={theme}
          toggle={toggle}
          favCount={favCount}
          otherOpen={otherOpen}
          setOtherOpen={setOtherOpen}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          openSearch={openSearch}
          goBack={goBack}
          navLinkClass={navLinkClass}
          isActive={isActive}
        />
        <NavMobile
          isMangaPage={isMangaPage}
          menuOpen={menuOpen}
          mobileOtherOpen={mobileOtherOpen}
          setMobileOtherOpen={setMobileOtherOpen}
          pathname={pathname}
          favCount={favCount}
          theme={theme}
          toggle={toggle}
          closeMenu={closeMenu}
          goBack={goBack}
          mobileLinkClass={mobileLinkClass}
          isActive={isActive}
        />
      </nav>
    </>
  );
}
