"use client";
import { useParams, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  getChapterPages,
  getChapterList,
  getMangaDetail,
  MangaDetail,
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
  const storedMeta = useMemo(() => {
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
    return getStoredMeta(source, id, chapterNum) ||
      getStoredMeta(source, id, params.chapterNum);
  }, [source, id, chapterNum, params.chapterNum]);
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
  const detailFetchRef = useRef<Promise<MangaDetail> | null>(null);

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

  // Pinch-to-zoom state (strip mode) — refs used for active gestures to avoid state lag
  const [zoomLevel, setZoomLevel] = useState(1);
  const zoomLevelRef = useRef(1);
  const [zoomOrigin, setZoomOrigin] = useState<{ x: number; y: number }>({
    x: 50,
    y: 50,
  });
  const [zoomedImageIdx, setZoomedImageIdx] = useState<number | null>(null);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const panOffsetRef = useRef({ x: 0, y: 0 });
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
  const pinchActiveRef = useRef(false); // true while 2 fingers are down

  // Night reading mode
  const [nightMode, setNightMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("manhwa-night-mode") === "true";
    }
    return false;
  });
  const [nightUiVisible, setNightUiVisible] = useState(false);
  const nightUiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Total chapters for history
  const [mangaTotalChapters, setMangaTotalChapters] = useState<number | undefined>(undefined);

  // Strip mode drag-scroll refs
  const stripDragRef = useRef({ dragging: false, startY: 0, startScrollY: 0 });



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
    if (!detailFetchRef.current) {
      detailFetchRef.current = getMangaDetail(id, source);
    }
    detailFetchRef.current
      .then((detail) => {
        if (!cancelled) {
          setMangaTitle(detail.manga.title);
          setMangaCover(detail.manga.cover || null);
          setMangaTotalChapters(detail.chapters.length);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, source]);

  // Set page title
  useEffect(() => {
    document.title = mangaTitle
      ? `${mangaTitle} - Chapter ${chapterNum}`
      : "Manga Reader";
  }, [mangaTitle, chapterNum]);

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
          totalChapters: mangaTotalChapters,
        });
      } else {
        if (!detailFetchRef.current) {
          detailFetchRef.current = getMangaDetail(id, source);
        }
        detailFetchRef.current
          .then((detail) => {
            addHistory({
              mangaId: id,
              title: detail.manga.title,
              cover: detail.manga.cover,
              source,
              chapterNumber: Number(chapterNum),
              totalChapters: detail.chapters.length,
            });
          })
          .catch(() => {
            addHistory({
              mangaId: id,
              title: `Manga ${id.slice(0, 8)}`,
              cover: null,
              source,
              chapterNumber: Number(chapterNum),
              totalChapters: undefined,
            });
          });
      }
    }
  }, [images.length, loading, id, source, chapterNum, mangaTitle, mangaCover, mangaTotalChapters]);

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

  // Persist reading settings
  useEffect(() => {
    localStorage.setItem("manhwa-reader-bg", bgColor);
  }, [bgColor]);
  useEffect(() => {
    localStorage.setItem("manhwa-reader-brightness", String(brightness));
  }, [brightness]);
  useEffect(() => {
    localStorage.setItem("manhwa-night-mode", String(nightMode));
  }, [nightMode]);

  // Cleanup night UI timer
  useEffect(() => {
    return () => { if (nightUiTimer.current) clearTimeout(nightUiTimer.current); };
  }, []);

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

  // Night mode tap to show UI
  const handleNightTap = useCallback(() => {
    if (!nightMode) return;
    setNightUiVisible(true);
    if (nightUiTimer.current) clearTimeout(nightUiTimer.current);
    nightUiTimer.current = setTimeout(() => setNightUiVisible(false), 3000);
  }, [nightMode]);

  // --- Strip mode drag-to-scroll (disabled during pinch) ---
  const handleStripPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 || pinchActiveRef.current) return;
    stripDragRef.current = {
      dragging: true,
      startY: e.clientY,
      startScrollY: window.scrollY,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handleStripPointerMove = useCallback((e: React.PointerEvent) => {
    if (!stripDragRef.current.dragging || pinchActiveRef.current) return;
    const delta = e.clientY - stripDragRef.current.startY;
    window.scrollTo(0, stripDragRef.current.startScrollY - delta);
  }, []);

  const handleStripPointerUp = useCallback(() => {
    stripDragRef.current.dragging = false;
  }, []);

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

  // Strip mode scroll progress bar
  useEffect(() => {
    if (images.length === 0) {
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
  }, [images.length]);

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
      } else {
        if (e.key === "ArrowDown" || e.key === " ") {
          e.preventDefault();
          scrollToNextImage();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          scrollToPrevImage();
        } else if (e.key === "n" || e.key === "N") {
          setNightMode(prev => !prev);
          return;
        }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    prevChapter,
    nextChapter,
    buildChapterUrl,
    scrollToNextImage,
    scrollToPrevImage,
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

  // Detect when user scrolls past 60% of chapter content
  useEffect(() => {
    if (!nextChapter || images.length === 0) return;
    function onScroll() {
      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY;
      const clientHeight = window.innerHeight;
      const progress = (scrollTop + clientHeight) / scrollHeight;
      if (progress >= 0.6) {
        setNearEnd(true);
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [nextChapter, images.length]);

  // Reset pinch-to-zoom when zoomed image scrolls out of viewport
  useEffect(() => {
    if (zoomedImageIdx === null) return;
    const idx = zoomedImageIdx;
    function checkScroll() {
      if (pinchActiveRef.current) return; // don't reset during active pinch
      const imgs = document.querySelectorAll("img[alt^='Halaman']");
      const img = imgs[idx] as HTMLElement | undefined;
      if (!img) {
        setZoomLevel(1);
        zoomLevelRef.current = 1;
        setZoomedImageIdx(null);
        setPanOffset({ x: 0, y: 0 });
        panOffsetRef.current = { x: 0, y: 0 };
        return;
      }
      const rect = img.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setZoomLevel(1);
        zoomLevelRef.current = 1;
        setZoomedImageIdx(null);
        setPanOffset({ x: 0, y: 0 });
        panOffsetRef.current = { x: 0, y: 0 };
      }
    }
    window.addEventListener("scroll", checkScroll, { passive: true });
    return () => window.removeEventListener("scroll", checkScroll);
  }, [zoomedImageIdx]);

  // Preload next chapter images once nearEnd triggers
  useEffect(() => {
    if (!nearEnd || !nextChapter) return;
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
        })
        .catch(() => {});
    } catch {
      // noop — preload is best-effort
    }
  }, [nearEnd, nextChapter, source, id]);

  const chromeHidden = nightMode && !nightUiVisible;

  return (
    <div 
      className={`min-h-screen ${nightMode ? "bg-black" : ""}`}
      onClick={handleNightTap}
    >
      {/* Night mode overlay */}
      {nightMode && (
        <div className="fixed inset-0 bg-black/70 z-40 pointer-events-none transition-opacity duration-300" />
      )}
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
      {!loading && !error && images.length > 0 && (
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
                    e.stopPropagation();
                    pinchActiveRef.current = true;
                    stripDragRef.current.dragging = false;
                    const dx = e.touches[0].clientX - e.touches[1].clientX;
                    const dy = e.touches[0].clientY - e.touches[1].clientY;
                    pinchStartRef.current = {
                      dist: Math.sqrt(dx * dx + dy * dy),
                      zoom: zoomLevelRef.current,
                    };
                  } else if (e.touches.length === 1) {
                    if (zoomedImageIdx === i && zoomLevelRef.current > 1) {
                      panStartRef.current = {
                        x: e.touches[0].clientX,
                        y: e.touches[0].clientY,
                        ox: panOffsetRef.current.x,
                        oy: panOffsetRef.current.y,
                      };
                    } else {
                      const now = Date.now();
                      const last = lastTapRef.current;
                      if (now - last.time < 300 && last.idx === i) {
                        if (zoomLevelRef.current > 1) {
                          // Double-tap zoom out: animate snap-back
                          const img = e.currentTarget.querySelector("img");
                          if (img) {
                            img.style.transition = "transform 0.2s ease-out";
                            img.style.transformOrigin = `${50}% ${50}%`;
                            img.style.transform = "translate(0px, 0px) scale(1)";
                          }
                          setTimeout(() => {
                            if (img) img.style.transition = "";
                            setZoomLevel(1);
                            zoomLevelRef.current = 1;
                            setZoomedImageIdx(null);
                            setPanOffset({ x: 0, y: 0 });
                            panOffsetRef.current = { x: 0, y: 0 };
                          }, 200);
                        } else {
                          // Double-tap zoom in
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const ox = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
                          const oy = ((e.touches[0].clientY - rect.top) / rect.height) * 100;
                          setZoomOrigin({ x: ox, y: oy });
                          setZoomLevel(2);
                          zoomLevelRef.current = 2;
                          setZoomedImageIdx(i);
                          setPanOffset({ x: 0, y: 0 });
                          panOffsetRef.current = { x: 0, y: 0 };
                          // Apply instantly without transition
                          const img = e.currentTarget.querySelector("img");
                          if (img) {
                            img.style.transition = "transform 0.2s ease-out";
                            img.style.transformOrigin = `${ox}% ${oy}%`;
                            img.style.transform = `scale(2)`;
                            setTimeout(() => { if (img) img.style.transition = ""; }, 220);
                          }
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
                    e.stopPropagation();
                    const dx = e.touches[0].clientX - e.touches[1].clientX;
                    const dy = e.touches[0].clientY - e.touches[1].clientY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const newZoom = Math.min(
                      3,
                      Math.max(
                        0.5,
                        pinchStartRef.current.zoom *
                          (dist / pinchStartRef.current.dist),
                      ),
                    );
                    // Direct DOM manipulation — no React state during pinch
                    const img = e.currentTarget.querySelector("img");
                    if (img) {
                      img.style.transition = "none";
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const ox = (((e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left) / rect.width) * 100;
                      const oy = (((e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top) / rect.height) * 100;
                      img.style.transformOrigin = `${ox}% ${oy}%`;
                      img.style.transform = `translate(0px, 0px) scale(${newZoom})`;
                    }
                    zoomLevelRef.current = newZoom;
                    // Track origin for state commit
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setZoomOrigin({
                      x: (((e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left) / rect.width) * 100,
                      y: (((e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top) / rect.height) * 100,
                    });
                    setZoomedImageIdx(newZoom > 1.05 ? i : null);
                  } else if (
                    e.touches.length === 1 &&
                    !pinchActiveRef.current &&
                    zoomedImageIdx === i &&
                    zoomLevelRef.current > 1
                  ) {
                    e.preventDefault();
                    const dx = e.touches[0].clientX - panStartRef.current.x;
                    const dy = e.touches[0].clientY - panStartRef.current.y;
                    const nx = panStartRef.current.ox + dx;
                    const ny = panStartRef.current.oy + dy;
                    // Direct DOM manipulation for pan
                    const img = e.currentTarget.querySelector("img");
                    if (img) {
                      img.style.transition = "none";
                      img.style.transform = `translate(${nx}px, ${ny}px) scale(${zoomLevelRef.current})`;
                    }
                    panOffsetRef.current = { x: nx, y: ny };
                    setPanOffset({ x: nx, y: ny });
                  }
                }}
                onTouchEnd={(e) => {
                  const wasPinching = pinchActiveRef.current;
                  pinchActiveRef.current = false;
                  if (wasPinching && e.touches.length === 0) {
                    // Pinch ended — commit final state
                    const z = zoomLevelRef.current;
                    if (z < 1.05) {
                      // Snap back to 1 with animation
                      const img = e.currentTarget.querySelector("img");
                      if (img) {
                        img.style.transition = "transform 0.2s ease-out";
                        img.style.transformOrigin = "50% 50%";
                        img.style.transform = "translate(0px, 0px) scale(1)";
                      }
                      setTimeout(() => {
                        if (img) img.style.transition = "";
                        setZoomLevel(1);
                        zoomLevelRef.current = 1;
                        setZoomedImageIdx(null);
                        setPanOffset({ x: 0, y: 0 });
                        panOffsetRef.current = { x: 0, y: 0 };
                      }, 200);
                    } else {
                      // Commit final zoom + pan to state
                      setZoomLevel(z);
                      setPanOffset({ ...panOffsetRef.current });
                    }
                  } else if (
                    !wasPinching &&
                    e.touches.length === 0 &&
                    zoomLevelRef.current > 1 &&
                    zoomLevelRef.current < 1.05
                  ) {
                    // Very small zoom after single-finger — snap back
                    const img = e.currentTarget.querySelector("img");
                    if (img) {
                      img.style.transition = "transform 0.2s ease-out";
                      img.style.transform = "translate(0px, 0px) scale(1)";
                    }
                    setTimeout(() => {
                      if (img) img.style.transition = "";
                      setZoomLevel(1);
                      zoomLevelRef.current = 1;
                      setZoomedImageIdx(null);
                      setPanOffset({ x: 0, y: 0 });
                      panOffsetRef.current = { x: 0, y: 0 };
                    }, 200);
                  }
                  pinchStartRef.current = { dist: 0, zoom: zoomLevelRef.current };
                }}
                onWheel={(e) => {
                  if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    const delta = -e.deltaY * 0.01;
                    const newZoom = Math.min(3, Math.max(1, zoomLevelRef.current + delta));
                    zoomLevelRef.current = newZoom;
                    setZoomLevel(newZoom);
                    setZoomedImageIdx(newZoom > 1 ? i : null);
                    if (newZoom <= 1) {
                      setPanOffset({ x: 0, y: 0 });
                      panOffsetRef.current = { x: 0, y: 0 };
                    }
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const ox = ((e.clientX - rect.left) / rect.width) * 100;
                    const oy = ((e.clientY - rect.top) / rect.height) * 100;
                    setZoomOrigin({ x: ox, y: oy });
                    // Direct DOM update for immediate feedback
                    const img = e.currentTarget.querySelector("img");
                    if (img) {
                      img.style.transition = "transform 0.1s ease-out";
                      img.style.transformOrigin = `${ox}% ${oy}%`;
                      img.style.transform = `translate(0px, 0px) scale(${newZoom})`;
                      setTimeout(() => { img.style.transition = ""; }, 120);
                    }
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
                    transition: "opacity 0.5s ease",
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

      {/* Bottom nav */}
      {!loading && !error && images.length > 0 && (
        <div className={`transition-opacity duration-300 ${chromeHidden ? "opacity-0 pointer-events-none" : ""}`}>
          {/* Gradient fade from content to footer */}
          <div className="h-24 bg-linear-to-b from-transparent to-bg" />

          <div className="w-full border-t border-border bg-surface">
            <div className="max-w-4xl mx-auto flex flex-col items-center gap-6 py-10 px-4">
              <p className="text-sm font-semibold text-text tracking-wide uppercase">
                Chapter {chapterNum} selesai
              </p>

              <Link
                href={mangaHref}
                className="flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-hover transition-colors duration-150 hover:underline underline-offset-4 decoration-accent"
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
                    className="px-5 py-2.5 text-[13px] font-medium rounded-lg bg-bg border border-border text-text-secondary hover:text-text hover:border-border-hover transition-all duration-150"
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
                    className="px-5 py-2.5 text-[13px] font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-all duration-150 shadow-md"
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
        </div>
      )}

      {/* Floating bubble (iOS AssistiveTouch style) */}
      {images.length > 0 && !loading && (
        <div
          className={`fixed z-50 select-none transition-opacity duration-300 ${chromeHidden ? "opacity-0 pointer-events-none" : ""}`}
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
            className="w-12 h-12 rounded-full bg-surface/90 backdrop-blur-sm border border-border shadow-lg shadow-black/20 flex items-center justify-center text-text-muted hover:text-text hover:border-border-hover transition-colors duration-150 cursor-pointer select-none touch-none"
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
