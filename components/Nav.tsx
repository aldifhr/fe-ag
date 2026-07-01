"use client";
import { useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import NavDesktop from "@/components/NavDesktop";
import NavMobile from "@/components/NavMobile";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();

  const isMangaPage = pathname.startsWith("/manga/");

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
      <nav className="sticky top-0 z-50 bg-bg/95 backdrop-blur-sm border-b border-border">
        <NavDesktop
          isMangaPage={isMangaPage}
          pathname={pathname}
          theme={theme}
          toggle={toggle}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          goBack={goBack}
          navLinkClass={navLinkClass}
        />
        <NavMobile
          isMangaPage={isMangaPage}
          menuOpen={menuOpen}
          theme={theme}
          toggle={toggle}
          closeMenu={closeMenu}
          goBack={goBack}
          mobileLinkClass={mobileLinkClass}
        />
      </nav>
    </>
  );
}
