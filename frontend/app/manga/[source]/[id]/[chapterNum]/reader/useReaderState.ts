"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  getChapterPages,
  getChapterList,
  getMangaDetail,
  MangaDetail,
} from "@/lib/api";
import { addHistory } from "@/lib/history";

interface UseReaderStateParams {
  source: string;
  id: string;
  chapterNum: string;
  effectiveBaseUrl: string;
  effectiveChapterId: string;
}

export function useReaderState({
  source,
  id,
  chapterNum,
  effectiveBaseUrl,
  effectiveChapterId,
}: UseReaderStateParams) {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chapters, setChapters] = useState<
    { id: string | number; number: string | number }[]
  >([]);
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

  // H7: ref-based loaded images tracking
  const loadedImagesRef = useRef(new Set<number>());
  const [loadedCount, setLoadedCount] = useState(0);

  const markImageLoaded = useCallback((idx: number) => {
    if (!loadedImagesRef.current.has(idx)) {
      loadedImagesRef.current.add(idx);
      setLoadedCount((c) => c + 1);
    }
  }, []);

  const [retryKeys, setRetryKeys] = useState<Map<number, number>>(new Map());
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

  // Night reading mode
  const [nightMode, setNightMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("manhwa-night-mode") === "true";
    }
    return false;
  });
  const [nightUiVisible, setNightUiVisible] = useState(false);
  const nightUiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mangaTotalChapters, setMangaTotalChapters] = useState<
    number | undefined
  >(undefined);

  const mangaHref = `/manga/${source}/${encodeURIComponent(id)}`;

  // Save chapter meta to localStorage for clean URLs
  useEffect(() => {
    if (effectiveBaseUrl || effectiveChapterId) {
      const key = `manhwa-meta-${source}-${id}-${chapterNum}`;
      localStorage.setItem(
        key,
        JSON.stringify({ baseUrl: effectiveBaseUrl, chapterId: effectiveChapterId }),
      );
    }
  }, [effectiveBaseUrl, effectiveChapterId, source, id, chapterNum]);

  useEffect(() => {
    let cancelled = false;

    async function fetchPages() {
      setLoading(true);
      setError(null);

      try {
        let chapterUrl = "";
        if (effectiveBaseUrl) {
          chapterUrl = `${effectiveBaseUrl.replace(/\/$/, "")}/chapter-${chapterNum}`;
        } else if (source === "ikiru") {
          chapterUrl = `https://06.ikiru.wtf/manga/${id.split("/").pop()}/chapter-${chapterNum}`;
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
          setError(
            err instanceof Error ? err.message : "Gagal memuat chapter",
          );
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
  }, [
    images.length,
    loading,
    id,
    source,
    chapterNum,
    mangaTitle,
    mangaCover,
    mangaTotalChapters,
  ]);

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
    return () => {
      if (nightUiTimer.current) clearTimeout(nightUiTimer.current);
    };
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
      Math.min(
        window.innerWidth - 72,
        e.clientX - bubbleStartOffset.current.x,
      ),
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
          setNightMode((prev) => !prev);
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

  // H7: Preload next 3 images using ref-based tracking
  useEffect(() => {
    if (images.length === 0) return;
    for (const idx of loadedImagesRef.current) {
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
  }, [images, loadedCount]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return {
    // Core data
    images,
    loading,
    error,
    chapters,
    mangaTitle,
    mangaCover,
    mangaTotalChapters,
    // UI state
    showScrollTop,
    settingsOpen,
    bubbleExpanded,
    bubblePos,
    nightMode,
    nightUiVisible,
    chromeHidden,
    // Settings
    bgColor,
    brightness,
    // H7: loaded images
    loadedImagesRef,
    loadedCount,
    markImageLoaded,
    // Retry
    retryKeys,
    setRetryKeys,
    // Scroll
    scrollProgress,
    // Navigation
    prevChapter,
    nextChapter,
    mangaHref,
    buildChapterUrl,
    // Callbacks
    scrollToNextImage,
    scrollToPrevImage,
    handleBubblePointerDown,
    handleBubblePointerMove,
    handleBubblePointerUp,
    handleNightTap,
    // Setters
    setBgColor,
    setBrightness,
    setSettingsOpen,
    setNightMode,
    setBubbleExpanded,
    setBubblePos,
    // Refs
    settingsRef,
  };
}
