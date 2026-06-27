"use client";
import { useParams, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  getChapterPages,
  getChapterList,
  getMangaDetail,
  proxyImage,
} from "@/lib/api";
import { addHistory } from "@/lib/history";
import Link from "next/link";

function SkeletonLoader() {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="skeleton w-full max-w-3xl aspect-3/4 rounded-lg"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

export default function ReaderPage() {
  const params = useParams<{
    source: string;
    id: string;
    chapterNum: string;
  }>();
  const searchParams = useSearchParams();
  const source = params.source;
  const id = decodeURIComponent(params.id);
  const chapterNum =
    params.chapterNum.replace(/^chapter\s+/i, "").trim() || params.chapterNum;
  const baseUrl = searchParams.get("baseUrl") || "";
  const chapterId = searchParams.get("chapterId") || "";

  // Clean URLs: fallback to localStorage when query params absent
  function getStoredMeta(s: string, m: string, c: string) {
    try {
      const raw = localStorage.getItem(`manhwa-meta-${s}-${m}-${c}`);
      return raw
        ? (JSON.parse(raw) as { baseUrl?: string; chapterId?: string })
        : null;
    } catch {
      return null;
    }
  }
  const storedMeta =
    typeof window !== "undefined"
      ? getStoredMeta(source, id, chapterNum) ||
        getStoredMeta(source, id, params.chapterNum)
      : null;
  const effectiveBaseUrl = baseUrl || storedMeta?.baseUrl || "";
  const effectiveChapterId = chapterId || storedMeta?.chapterId || "";

  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chapters, setChapters] = useState<
    { id: string | number; number: string | number }[]
  >([]);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [readingMode, setReadingMode] = useState<"strip" | "paged">(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("manhwa-reading-mode");
      if (stored === "paged" || stored === "strip") return stored;
    }
    return "strip";
  });
  const [currentPage, setCurrentPage] = useState(0);
  const [bgColor, setBgColor] = useState<
    "default" | "dark" | "sepia" | "white"
  >(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("manhwa-reader-bg");
      if (
        stored === "default" ||
        stored === "dark" ||
        stored === "sepia" ||
        stored === "white"
      )
        return stored;
    }
    return "default";
  });
  const [brightness, setBrightness] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("manhwa-reader-brightness");
      if (stored) {
        const num = parseFloat(stored);
        if (!isNaN(num) && num >= 0.5 && num <= 1) return num;
      }
    }
    return 1;
  });
  const [mangaTitle, setMangaTitle] = useState<string | null>(null);
  const [mangaCover, setMangaCover] = useState<string | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const preloadedUrls = useRef<Set<string>>(new Set());

  // Image retry state — tracks cache-busting key per image index
  const [retryKeys, setRetryKeys] = useState<Map<number, number>>(new Map());
  // Chapter preload state — fires once when user scrolls past 80%
  const [nearEnd, setNearEnd] = useState(false);

  // Floating bubble state
  const [bubbleExpanded, setBubbleExpanded] = useState(false);
  const [bubblePos, setBubblePos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const bubbleDragging = useRef(false);
  const bubbleMoved = useRef(false);
  const bubbleStartPos = useRef({ x: 0, y: 0 });
  const bubbleStartOffset = useRef({ x: 0, y: 0 });

  // Pinch-to-zoom state (strip mode)
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomOrigin, setZoomOrigin] = useState<{ x: number; y: number }>({
    x: 50,
    y: 50,
  });
  const [zoomedImageIdx, setZoomedImageIdx] = useState<number | null>(null);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const lastTapRef = useRef<{ time: number; idx: number }>({
    time: 0,
    idx: -1,
  });
  const pinchStartRef = useRef<{ dist: number; zoom: number }>({
    dist: 0,
    zoom: 1,
  });
  const panStartRef = useRef<{ x: number; y: number; ox: number; oy: number }>({
    x: 0,
    y: 0,
    ox: 0,
    oy: 0,
  });

  // Chapter preloading indicator
  const [preloading, setPreloading] = useState(false);
  const [preloadDone, setPreloadDone] = useState(false);

  // Strip mode drag-scroll refs
  const stripDragRef = useRef({ dragging: false, startY: 0, startScrollY: 0 });

  // Paged mode swipe refs
  const pagedDragRef = useRef({
    startX: 0,
    startY: 0,
    dragging: false,
    moved: false,
    offsetX: 0,
  });
  const [pagedDragOffset, setPagedDragOffset] = useState(0);

  const mangaHref = `/manga/${source}/${encodeURIComponent(id)}`;

  // Save chapter meta to localStorage for clean URLs
  useEffect(() => {
    if (baseUrl || chapterId) {
      const key = `manhwa-meta-${source}-${id}-${chapterNum}`;
      localStorage.setItem(key, JSON.stringify({ baseUrl, chapterId }));
    }
  }, [baseUrl, chapterId, source, id, chapterNum]);

  useEffect(() => {
    let cancelled = false;

    async function fetchPages() {
      setLoading(true);
      setError(null);

      try {
        let chapterUrl = "";
        if (effectiveBaseUrl) {
          chapterUrl = `${effectiveBaseUrl.replace(/\/$/, "")}/chapter-${chapterNum}`;
        } else {
          chapterUrl = `https://shinigami.asia/manga/${id.split("/").pop()}/chapter-${chapterNum}`;
        }

        const data = await getChapterPages(
          chapterUrl,
          source,
          effectiveChapterId,
          effectiveBaseUrl || undefined,
          chapterNum || undefined,
        );
        if (!cancelled) {
          setImages(data.images);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Gagal memuat chapter");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPages();
    return () => {
      cancelled = true;
    };
  }, [source, id, chapterNum, effectiveBaseUrl, effectiveChapterId]);

  // Fetch manga title early for breadcrumb
  useEffect(() => {
    let cancelled = false;
    getMangaDetail(id, source)
      .then((detail) => {
        if (!cancelled) {
          setMangaTitle(detail.manga.title);
          setMangaCover(detail.manga.cover || null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, source]);

  // Record reading history when images load
  useEffect(() => {
    if (images.length > 0 && !loading) {
      // Use mangaTitle if already fetched, otherwise fetch for history
      if (mangaTitle) {
        addHistory({
          mangaId: id,
          title: mangaTitle,
          cover: mangaCover,
          source,
          chapterNumber: Number(chapterNum),
        });
      } else {
        getMangaDetail(id, source)
          .then((detail) => {
            addHistory({
              mangaId: id,
              title: detail.manga.title,
              cover: detail.manga.cover,
              source,
              chapterNumber: Number(chapterNum),
            });
          })
          .catch(() => {
            addHistory({
              mangaId: id,
              title: `Manga ${id.slice(0, 8)}`,
              cover: null,
              source,
              chapterNumber: Number(chapterNum),
            });
          });
      }
    }
  }, [images.length, loading, id, source, chapterNum, mangaTitle, mangaCover]);

  // Fetch chapter list for prev/next navigation
  useEffect(() => {
    let cancelled = false;
    getChapterList(id, source)
      .then((chs) => {
        if (!cancelled) setChapters(chs);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [source, id]);

  // Show scroll-to-top button after scrolling past first image
  useEffect(() => {
    function onScroll() {
      setShowScrollTop(window.scrollY > 400);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Sort ascending so prev = older chapter, next = newer chapter (intuitive direction)
  const sortedAsc = [...chapters].sort(
    (a, b) => Number(a.number) - Number(b.number),
  );
  const currentAscIdx = sortedAsc.findIndex(
    (ch) => String(ch.number) === String(chapterNum),
  );
  const prevChapter = currentAscIdx > 0 ? sortedAsc[currentAscIdx - 1] : null;
  const nextChapter =
    currentAscIdx >= 0 && currentAscIdx < sortedAsc.length - 1
      ? sortedAsc[currentAscIdx + 1]
      : null;

  const buildChapterUrl = useCallback(
    (ch: { number: string | number; id: string | number }) => {
      return `/manga/${source}/${encodeURIComponent(id)}/${ch.number}`;
    },
    [source, id],
  );

  // Persist reading mode to localStorage
  useEffect(() => {
    localStorage.setItem("manhwa-reading-mode", readingMode);
  }, [readingMode]);

  // Persist reading settings
  useEffect(() => {
    localStorage.setItem("manhwa-reader-bg", bgColor);
  }, [bgColor]);
  useEffect(() => {
    localStorage.setItem("manhwa-reader-brightness", String(brightness));
  }, [brightness]);

  // Close settings panel on outside click
  useEffect(() => {
    if (!settingsOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(e.target as Node)
      ) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [settingsOpen]);

  // Floating bubble drag handlers
  const handleBubblePointerDown = useCallback((e: React.PointerEvent) => {
    bubbleDragging.current = true;
    bubbleMoved.current = false;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    bubbleStartPos.current = { x: e.clientX, y: e.clientY };
    bubbleStartOffset.current = {
      x: e.clientX - rect.left - rect.width / 2,
      y: e.clientY - rect.top - rect.height / 2,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handleBubblePointerMove = useCallback((e: React.PointerEvent) => {
    if (!bubbleDragging.current) return;
    const dx = e.clientX - bubbleStartPos.current.x;
    const dy = e.clientY - bubbleStartPos.current.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) bubbleMoved.current = true;
    const clampedX = Math.max(
      16,
      Math.min(window.innerWidth - 72, e.clientX - bubbleStartOffset.current.x),
    );
    const clampedY = Math.max(
      80,
      Math.min(
        window.innerHeight - 80,
        e.clientY - bubbleStartOffset.current.y,
      ),
    );
    setBubblePos({ x: clampedX, y: clampedY });
  }, []);

  const handleBubblePointerUp = useCallback(() => {
    bubbleDragging.current = false;
    // If no drag happened, toggle the menu
    if (!bubbleMoved.current) {
      setBubbleExpanded((v) => !v);
    }
  }, []);

  // --- Strip mode drag-to-scroll ---
  const handleStripPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    stripDragRef.current = {
      dragging: true,
      startY: e.clientY,
      startScrollY: window.scrollY,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handleStripPointerMove = useCallback((e: React.PointerEvent) => {
    if (!stripDragRef.current.dragging) return;
    const delta = e.clientY - stripDragRef.current.startY;
    window.scrollTo(0, stripDragRef.current.startScrollY - delta);
  }, []);

  const handleStripPointerUp = useCallback(() => {
    stripDragRef.current.dragging = false;
  }, []);

  // --- Paged mode swipe-to-navigate ---
  const handlePagedPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    pagedDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      dragging: true,
      moved: false,
      offsetX: 0,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePagedPointerMove = useCallback((e: React.PointerEvent) => {
    if (!pagedDragRef.current.dragging) return;
    const dx = e.clientX - pagedDragRef.current.startX;
    const dy = e.clientY - pagedDragRef.current.startY;
    // If initial movement is mostly vertical, let native scroll handle it
    if (!pagedDragRef.current.moved && Math.abs(dy) > Math.abs(dx)) return;
    if (Math.abs(dx) > 10) pagedDragRef.current.moved = true;
    if (!pagedDragRef.current.moved) return;
    pagedDragRef.current.offsetX = dx;
    setPagedDragOffset(dx);
  }, []);

  const handlePagedPointerUp = useCallback(() => {
    if (!pagedDragRef.current.dragging) return;
    pagedDragRef.current.dragging = false;
    const dx = pagedDragRef.current.offsetX;
    if (dx < -30 && currentPage < images.length - 1) {
      setCurrentPage((p) => p + 1);
    } else if (dx > 30 && currentPage > 0) {
      setCurrentPage((p) => p - 1);
    }
    setPagedDragOffset(0);
  }, [currentPage, images.length]);

  const scrollToNextImage = useCallback(() => {
    const imgs = document.querySelectorAll("img[alt^='Halaman']");
    for (const img of Array.from(imgs)) {
      const rect = img.getBoundingClientRect();
      if (rect.top > 60) {
        img.scrollIntoView({ behavior: "smooth", block: "start" });
        break;
      }
    }
  }, []);

  const scrollToPrevImage = useCallback(() => {
    const imgs = Array.from(
      document.querySelectorAll("img[alt^='Halaman']"),
    ).reverse();
    for (const img of imgs) {
      const rect = img.getBoundingClientRect();
      if (rect.bottom < window.innerHeight - 50 && rect.top < 0) {
        img.scrollIntoView({ behavior: "smooth", block: "start" });
        break;
      }
    }
  }, []);

  // Reset to first image when switching to paged mode
  useEffect(() => {
    if (readingMode === "paged") {
      setCurrentPage(0);
    }
  }, [readingMode]);

  // Strip mode scroll progress bar
  useEffect(() => {
    if (readingMode !== "strip" || images.length === 0) {
      setScrollProgress(0);
      return;
    }
    let rafId: number;
    function onScroll() {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setScrollProgress(
          max > 0 ? Math.min((window.scrollY / max) * 100, 100) : 0,
        );
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
    };
  }, [readingMode, images.length]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "ArrowLeft" && prevChapter) {
        e.preventDefault();
        window.location.href = buildChapterUrl(prevChapter);
      } else if (e.key === "ArrowRight" && nextChapter) {
        e.preventDefault();
        window.location.href = buildChapterUrl(nextChapter);
      } else if (readingMode === "paged") {
        if (e.key === "ArrowDown" || e.key === " ") {
          e.preventDefault();
          if (currentPage < images.length - 1) setCurrentPage((p) => p + 1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          if (currentPage > 0) setCurrentPage((p) => p - 1);
        }
      } else {
        if (e.key === "ArrowDown" || e.key === " ") {
          e.preventDefault();
          const imgs = document.querySelectorAll("img[alt^='Halaman']");
          for (const img of Array.from(imgs)) {
            const rect = img.getBoundingClientRect();
            if (rect.top > 50) {
              img.scrollIntoView({ behavior: "smooth", block: "start" });
              break;
            }
          }
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          const imgs = Array.from(
            document.querySelectorAll("img[alt^='Halaman']"),
          ).reverse();
          for (const img of imgs) {
            const rect = img.getBoundingClientRect();
            if (rect.bottom < window.innerHeight - 50 && rect.top < 0) {
              img.scrollIntoView({ behavior: "smooth", block: "start" });
              break;
            }
          }
        }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    prevChapter,
    nextChapter,
    buildChapterUrl,
    readingMode,
    currentPage,
    images.length,
  ]);

  // Preload next 3 images after each image loads
  useEffect(() => {
    if (images.length === 0) return;
    for (const idx of loadedImages) {
      for (let offset = 1; offset <= 3; offset++) {
        const nextIdx = idx + offset;
        if (nextIdx >= images.length) break;
        const url = images[nextIdx];
        if (!preloadedUrls.current.has(url)) {
          preloadedUrls.current.add(url);
          const img = new Image();
          img.src = url;
        }
      }
    }
    return () => {
      preloadedUrls.current.clear();
    };
  }, [images, loadedImages]);

  // Detect when user scrolls past 80% of chapter content
  useEffect(() => {
    if (!nextChapter || images.length === 0) return;
    function onScroll() {
      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY;
      const clientHeight = window.innerHeight;
      const progress = (scrollTop + clientHeight) / scrollHeight;
      if (progress >= 0.8) {
        setNearEnd(true);
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [nextChapter, images.length]);

  // Reset pinch-to-zoom when zoomed image scrolls out of viewport
  useEffect(() => {
    if (zoomedImageIdx === null || readingMode !== "strip") return;
    const idx = zoomedImageIdx;
    function checkScroll() {
      const imgs = document.querySelectorAll("img[alt^='Halaman']");
      const img = imgs[idx] as HTMLElement | undefined;
      if (!img) {
        setZoomLevel(1);
        setZoomedImageIdx(null);
        setPanOffset({ x: 0, y: 0 });
        return;
      }
      const rect = img.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setZoomLevel(1);
        setZoomedImageIdx(null);
        setPanOffset({ x: 0, y: 0 });
      }
    }
    window.addEventListener("scroll", checkScroll, { passive: true });
    return () => window.removeEventListener("scroll", checkScroll);
  }, [zoomedImageIdx, readingMode]);

  // Reset zoom when switching reading modes
  useEffect(() => {
    setZoomLevel(1);
    setZoomedImageIdx(null);
    setPanOffset({ x: 0, y: 0 });
  }, [readingMode]);

  // Preload next chapter images once nearEnd triggers
  useEffect(() => {
    if (!nearEnd || !nextChapter) return;
    setPreloading(true);
    const nextChapterNum = String(nextChapter.number);
    try {
      const raw = localStorage.getItem(
        `manhwa-meta-${source}-${id}-${nextChapterNum}`,
      );
      const meta = raw
        ? (JSON.parse(raw) as { baseUrl?: string; chapterId?: string })
        : null;
      const nextBaseUrl = meta?.baseUrl || "";
      const nextChapterId = meta?.chapterId || "";
      let chapterUrl = "";
      if (nextBaseUrl) {
        chapterUrl = `${nextBaseUrl.replace(/\/$/, "")}/chapter-${nextChapterNum}`;
      }
      getChapterPages(
        chapterUrl,
        source,
        nextChapterId,
        nextBaseUrl || undefined,
        nextChapterNum,
      )
        .then((data) => {
          data.images.forEach((url) => {
            if (!preloadedUrls.current.has(url)) {
              preloadedUrls.current.add(url);
              const img = new Image();
              img.src = url;
            }
          });
          setPreloading(false);
          setPreloadDone(true);
          setTimeout(() => setPreloadDone(false), 1500);
        })
        .catch(() => {
          setPreloading(false);
        });
    } catch {
      setPreloading(false);
    }
  }, [nearEnd, nextChapter, source, id]);

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-bg/95 backdrop-blur-sm border-b border-border">
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

            {/* Reading mode toggle */}
            <button
              onClick={() =>
                setReadingMode(readingMode === "strip" ? "paged" : "strip")
              }
              className="flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-md bg-surface border border-border text-text-secondary hover:text-text hover:border-(--color-border-hover) transition-colors duration-150 cursor-pointer"
              aria-label={`Ganti mode ke ${readingMode === "strip" ? "paged" : "strip"}`}
            >
              {readingMode === "strip" ? (
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
                  <path d="M12 5v14" />
                  <path d="M19 12l-7 7-7-7" />
                  <path d="M5 12l7-7 7 7" />
                </svg>
              ) : (
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
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              )}
              {readingMode === "strip" ? "Strip" : "Paged"}
            </button>
          </div>
        </div>
      </header>

      {/* Reading progress bar */}
      <div className="h-0.5 bg-transparent">
        <div
          className="h-full bg-accent transition-[width] duration-100"
          style={{
            width:
              readingMode === "paged"
                ? `${((currentPage + 1) / Math.max(images.length, 1)) * 100}%`
                : `${scrollProgress}%`,
          }}
        />
      </div>

      {/* Breadcrumb */}
      <nav
        className="max-w-4xl mx-auto px-4 py-2 text-[12px] text-text-muted flex items-center gap-1.5 flex-wrap"
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

      {/* Error */}
      {error && (
        <div className="text-center py-20 px-4">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-surface border border-border flex items-center justify-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-danger)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
            </svg>
          </div>
          <p className="text-sm text-text-secondary mb-1">Gagal: {error}</p>
          <p className="text-[12px] text-text-muted">
            Coba buka manual: {effectiveBaseUrl}/chapter-{chapterNum}
          </p>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && images.length === 0 && (
        <div className="text-center py-20">
          <p className="text-text-muted text-sm">
            Tidak ada gambar ditemukan. Site mungkin block scraper atau URL
            salah.
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && <SkeletonLoader />}

      {/* Images — strip mode */}
      {!loading && !error && images.length > 0 && readingMode === "strip" && (
        <div
          className={`flex flex-col items-center select-none cursor-grab active:cursor-grabbing ${bgColor === "dark" ? "bg-black" : bgColor === "sepia" ? "bg-[#d4c5a0]" : bgColor === "white" ? "bg-white" : ""}`}
          style={{ touchAction: "pan-y" }}
          onPointerDown={handleStripPointerDown}
          onPointerMove={handleStripPointerMove}
          onPointerUp={handleStripPointerUp}
        >
          {images.map((src, i) => {
            const loaded = loadedImages.has(i);
            const retryN = retryKeys.get(i);
            const baseSrc = proxyImage(src);
            const imgSrc = retryN
              ? `${baseSrc}${baseSrc.includes("?") ? "&" : "?"}retry=${retryN}`
              : baseSrc;
            return (
              <div
                key={i}
                className={`relative w-full max-w-3xl mx-auto ${zoomedImageIdx === i ? "overflow-hidden" : ""}`}
                style={{
                  ...(brightness < 1
                    ? { filter: `brightness(${brightness})` }
                    : {}),
                  touchAction: zoomedImageIdx === i ? "none" : "pan-y",
                }}
                onTouchStart={(e) => {
                  if (e.touches.length === 2) {
                    e.preventDefault();
                    const dx = e.touches[0].clientX - e.touches[1].clientX;
                    const dy = e.touches[0].clientY - e.touches[1].clientY;
                    pinchStartRef.current = {
                      dist: Math.sqrt(dx * dx + dy * dy),
                      zoom: zoomLevel,
                    };
                  } else if (e.touches.length === 1) {
                    if (zoomedImageIdx === i && zoomLevel > 1) {
                      panStartRef.current = {
                        x: e.touches[0].clientX,
                        y: e.touches[0].clientY,
                        ox: panOffset.x,
                        oy: panOffset.y,
                      };
                    } else {
                      const now = Date.now();
                      const last = lastTapRef.current;
                      if (now - last.time < 300 && last.idx === i) {
                        if (zoomLevel > 1) {
                          setZoomLevel(1);
                          setZoomedImageIdx(null);
                          setPanOffset({ x: 0, y: 0 });
                        } else {
                          const rect = (
                            e.currentTarget as HTMLElement
                          ).getBoundingClientRect();
                          setZoomOrigin({
                            x:
                              ((e.touches[0].clientX - rect.left) /
                                rect.width) *
                              100,
                            y:
                              ((e.touches[0].clientY - rect.top) /
                                rect.height) *
                              100,
                          });
                          setZoomLevel(2);
                          setZoomedImageIdx(i);
                        }
                        lastTapRef.current = { time: 0, idx: -1 };
                      } else {
                        lastTapRef.current = { time: now, idx: i };
                      }
                    }
                  }
                }}
                onTouchMove={(e) => {
                  if (
                    e.touches.length === 2 &&
                    pinchStartRef.current.dist > 0
                  ) {
                    e.preventDefault();
                    const dx = e.touches[0].clientX - e.touches[1].clientX;
                    const dy = e.touches[0].clientY - e.touches[1].clientY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const newZoom = Math.min(
                      3,
                      Math.max(
                        1,
                        pinchStartRef.current.zoom *
                          (dist / pinchStartRef.current.dist),
                      ),
                    );
                    setZoomLevel(newZoom);
                    setZoomedImageIdx(newZoom > 1 ? i : null);
                    if (newZoom <= 1) setPanOffset({ x: 0, y: 0 });
                    const rect = (
                      e.currentTarget as HTMLElement
                    ).getBoundingClientRect();
                    setZoomOrigin({
                      x:
                        (((e.touches[0].clientX + e.touches[1].clientX) / 2 -
                          rect.left) /
                          rect.width) *
                        100,
                      y:
                        (((e.touches[0].clientY + e.touches[1].clientY) / 2 -
                          rect.top) /
                          rect.height) *
                        100,
                    });
                  } else if (
                    e.touches.length === 1 &&
                    zoomedImageIdx === i &&
                    zoomLevel > 1
                  ) {
                    e.preventDefault();
                    const dx = e.touches[0].clientX - panStartRef.current.x;
                    const dy = e.touches[0].clientY - panStartRef.current.y;
                    setPanOffset({
                      x: panStartRef.current.ox + dx,
                      y: panStartRef.current.oy + dy,
                    });
                  }
                }}
                onTouchEnd={() => {
                  if (zoomLevel > 1 && zoomLevel < 1.1) {
                    setZoomLevel(1);
                    setZoomedImageIdx(null);
                    setPanOffset({ x: 0, y: 0 });
                  }
                  pinchStartRef.current = { dist: 0, zoom: zoomLevel };
                }}
                onWheel={(e) => {
                  if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    const delta = -e.deltaY * 0.01;
                    const newZoom = Math.min(3, Math.max(1, zoomLevel + delta));
                    setZoomLevel(newZoom);
                    setZoomedImageIdx(newZoom > 1 ? i : null);
                    if (newZoom <= 1) setPanOffset({ x: 0, y: 0 });
                    const rect = (
                      e.currentTarget as HTMLElement
                    ).getBoundingClientRect();
                    setZoomOrigin({
                      x: ((e.clientX - rect.left) / rect.width) * 100,
                      y: ((e.clientY - rect.top) / rect.height) * 100,
                    });
                  }
                }}
              >
                <div
                  className={`skeleton w-full aspect-3/4 rounded-lg transition-opacity duration-300 ${
                    loaded ? "opacity-0 absolute inset-0" : "opacity-100"
                  }`}
                  style={{ animationDelay: `${(i % 6) * 150}ms` }}
                />
                <img
                  src={imgSrc}
                  alt={`Halaman ${i + 1}`}
                  className={`w-full object-contain ${
                    loaded ? "opacity-100" : "opacity-0"
                  }`}
                  style={{
                    transition: "opacity 0.5s ease, transform 0.2s ease",
                    transform:
                      zoomedImageIdx === i
                        ? `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`
                        : undefined,
                    transformOrigin:
                      zoomedImageIdx === i
                        ? `${zoomOrigin.x}% ${zoomOrigin.y}%`
                        : undefined,
                    maxWidth: "48rem",
                    height: "auto",
                    objectFit: "contain",
                  }}
                  loading={i === 0 ? "eager" : "lazy"}
                  onLoad={() => {
                    setLoadedImages((prev) => {
                      const next = new Set(prev);
                      next.add(i);
                      return next;
                    });
                  }}
                  onError={() => {
                    const current = retryKeys.get(i) || 0;
                    if (current < 2) {
                      setTimeout(
                        () => {
                          setRetryKeys((prev) => {
                            const next = new Map(prev);
                            next.set(i, current + 1);
                            return next;
                          });
                        },
                        (current + 1) * 1000,
                      );
                    }
                  }}
                />
                {retryN != null && retryN > 0 && retryN < 2 && !loaded && (
                  <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] text-text-muted bg-surface/80 px-2 py-0.5 rounded">
                    Retry {retryN}/2…
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Images — paged mode */}
      {!loading && !error && images.length > 0 && readingMode === "paged" && (
        <div
          className={`flex flex-col items-center min-h-[70dvh] ${bgColor === "dark" ? "bg-black" : bgColor === "sepia" ? "bg-[#d4c5a0]" : bgColor === "white" ? "bg-white" : ""}`}
        >
          <div
            className="relative w-full max-w-3xl mx-auto flex items-center justify-center select-none"
            style={{
              touchAction: "pan-y",
              ...(brightness < 1
                ? { filter: `brightness(${brightness})` }
                : {}),
            }}
          >
            <img
              src={(() => {
                const b = proxyImage(images[currentPage]);
                const r = retryKeys.get(currentPage);
                return r ? `${b}${b.includes("?") ? "&" : "?"}retry=${r}` : b;
              })()}
              alt={`Halaman ${currentPage + 1}`}
              className="w-full object-contain cursor-grab active:cursor-grabbing"
              style={{
                maxWidth: "48rem",
                height: "auto",
                objectFit: "contain",
                transform: `translateX(${pagedDragOffset}px)`,
                transition:
                  pagedDragOffset === 0
                    ? "transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
                    : "none",
              }}
              loading="eager"
              onLoad={() => {
                setLoadedImages((prev) => {
                  const next = new Set(prev);
                  next.add(currentPage);
                  return next;
                });
              }}
              onError={() => {
                const current = retryKeys.get(currentPage) || 0;
                if (current < 2) {
                  setTimeout(
                    () => {
                      setRetryKeys((prev) => {
                        const next = new Map(prev);
                        next.set(currentPage, current + 1);
                        return next;
                      });
                    },
                    (current + 1) * 1000,
                  );
                }
              }}
              onPointerDown={handlePagedPointerDown}
              onPointerMove={handlePagedPointerMove}
              onPointerUp={handlePagedPointerUp}
            />
            {retryKeys.get(currentPage) != null &&
              (retryKeys.get(currentPage) || 0) > 0 &&
              (retryKeys.get(currentPage) || 0) < 2 && (
                <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-text-muted bg-surface/80 px-2 py-0.5 rounded">
                  Retry {retryKeys.get(currentPage)}/2…
                </p>
              )}
          </div>

          <div className="flex items-center justify-center gap-4 py-4">
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className={`flex items-center gap-1.5 text-[13px] px-4 py-2 rounded-lg border transition-all duration-150 cursor-pointer ${
                currentPage === 0
                  ? "bg-bg border-border text-text-muted opacity-40 cursor-not-allowed"
                  : "bg-bg border-border text-text-secondary hover:text-text hover:border-(--color-border-hover)"
              }`}
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
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
              Prev
            </button>

            <span className="text-[13px] text-text-secondary tabular-nums select-none">
              Halaman {currentPage + 1} / {images.length}
            </span>

            {currentPage < images.length - 1 ? (
              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                className="flex items-center gap-1.5 text-[13px] px-4 py-2 rounded-lg bg-accent text-white hover:bg-(--color-accent-hover) transition-all duration-150 shadow-md shadow-(--color-accent-dim) cursor-pointer"
              >
                Next
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
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <span className="text-[13px] text-text-muted italic">
                  Chapter selesai
                </span>
                <div className="flex items-center gap-3">
                  {prevChapter && (
                    <button
                      onClick={() => {
                        window.location.href = buildChapterUrl(prevChapter);
                      }}
                      className="flex items-center gap-1.5 text-[13px] px-4 py-2 rounded-lg bg-bg border border-border text-text-secondary hover:bg-surface transition-all duration-150 cursor-pointer"
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
                        <path d="M19 12H5" />
                        <path d="M12 19l-7-7 7-7" />
                      </svg>
                      Chapter Sebelumnya
                    </button>
                  )}
                  {nextChapter && (
                    <button
                      onClick={() => {
                        window.location.href = buildChapterUrl(nextChapter);
                      }}
                      className="flex items-center gap-1.5 text-[13px] px-4 py-2 rounded-lg bg-accent text-white hover:bg-(--color-accent-hover) transition-all duration-150 shadow-md shadow-(--color-accent-dim) cursor-pointer"
                    >
                      Chapter Selanjutnya
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
                        <path d="M5 12h14" />
                        <path d="M12 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom nav — only in strip mode */}
      {!loading && !error && images.length > 0 && readingMode === "strip" && (
        <>
          {/* Gradient fade from content to footer */}
          <div className="h-24 bg-linear-to-b from-transparent to-(--color-bg)" />

          <div className="w-full border-t border-border bg-surface">
            <div className="max-w-4xl mx-auto flex flex-col items-center gap-6 py-10 px-4">
              <p className="text-sm font-semibold text-text tracking-wide uppercase">
                Chapter {chapterNum} selesai
              </p>

              <Link
                href={mangaHref}
                className="flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-hover transition-colors duration-150 hover:underline underline-offset-4 decoration-(--color-accent)"
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
                Kembali ke Detail
              </Link>

              {/* Prev / Next */}
              <div className="flex items-center gap-3">
                {prevChapter ? (
                  <Link
                    href={buildChapterUrl(prevChapter)}
                    className="px-5 py-2.5 text-[13px] font-medium rounded-lg bg-bg border border-border text-text-secondary hover:text-text hover:border-(--color-border-hover) transition-all duration-150"
                  >
                    &larr; Prev
                  </Link>
                ) : (
                  <span className="px-5 py-2.5 text-[13px] font-medium rounded-lg bg-bg border border-border text-text-muted opacity-40 cursor-not-allowed select-none pointer-events-none">
                    &larr; Prev
                  </span>
                )}
                {nextChapter ? (
                  <Link
                    href={buildChapterUrl(nextChapter)}
                    className="px-5 py-2.5 text-[13px] font-medium rounded-lg bg-accent text-white hover:bg-(--color-accent-hover) transition-all duration-150 shadow-md shadow-(--color-accent-dim)"
                  >
                    Next &rarr;
                  </Link>
                ) : (
                  <span className="px-5 py-2.5 text-[13px] font-medium rounded-lg bg-accent text-white opacity-40 cursor-not-allowed select-none pointer-events-none">
                    Next &rarr;
                  </span>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Preloading indicator toast */}
      {preloading && nextChapter && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full bg-surface/90 backdrop-blur-sm border border-border shadow-lg text-text-secondary text-xs flex items-center gap-2 animate-[fadeIn_0.2s_ease]">
          <svg
            className="animate-spin"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          Memuat chapter berikutnya...
        </div>
      )}
      {preloadDone && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full bg-emerald-500/90 backdrop-blur-sm text-white text-xs flex items-center gap-2 animate-[fadeIn_0.2s_ease]">
          ✓ Siap!
        </div>
      )}

      {/* Floating bubble (iOS AssistiveTouch style) */}
      {images.length > 0 && !loading && (
        <div
          className="fixed z-50 select-none"
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
            className="w-12 h-12 rounded-full bg-surface/90 backdrop-blur-sm border border-border shadow-lg shadow-black/20 flex items-center justify-center text-text-muted hover:text-text hover:border-(--color-border-hover) transition-colors duration-150 cursor-pointer select-none touch-none"
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
      )}
    </div>
  );
}
