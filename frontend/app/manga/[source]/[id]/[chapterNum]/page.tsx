"use client";
import { useParams, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { getChapterPages, getChapterList, getMangaDetail } from "@/lib/api";
import { addHistory } from "@/lib/history";
import Link from "next/link";

function SkeletonLoader() {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="skeleton w-full max-w-3xl aspect-[3/4] rounded-lg"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

export default function ReaderPage() {
  const params = useParams<{ source: string; id: string; chapterNum: string }>();
  const searchParams = useSearchParams();
  const source = params.source;
  const id = decodeURIComponent(params.id);
  const chapterNum = params.chapterNum;
  const baseUrl = searchParams.get("baseUrl") || "";
  const chapterId = searchParams.get("chapterId") || "";

  // Clean URLs: fallback to localStorage when query params absent
  function getStoredMeta(s: string, m: string, c: string) {
    try {
      const raw = localStorage.getItem(`manhwa-meta-${s}-${m}-${c}`);
      return raw ? (JSON.parse(raw) as { baseUrl?: string; chapterId?: string }) : null;
    } catch { return null; }
  }
  const storedMeta = typeof window !== "undefined" ? getStoredMeta(source, id, chapterNum) : null;
  const effectiveBaseUrl = baseUrl || storedMeta?.baseUrl || "";
  const effectiveChapterId = chapterId || storedMeta?.chapterId || "";

  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fitMode, setFitMode] = useState<"width" | "height">("width");
  const [chapters, setChapters] = useState<{ id: string | number; number: string | number }[]>([]);
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
  const [bgColor, setBgColor] = useState<"default" | "dark" | "sepia" | "white">(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("manhwa-reader-bg");
      if (stored === "default" || stored === "dark" || stored === "sepia" || stored === "white") return stored;
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Floating bubble state
  const [bubbleExpanded, setBubbleExpanded] = useState(false);
  const [bubblePos, setBubblePos] = useState<{ x: number; y: number } | null>(null);
  const bubbleDragging = useRef(false);
  const bubbleMoved = useRef(false);
  const bubbleStartPos = useRef({ x: 0, y: 0 });
  const bubbleStartOffset = useRef({ x: 0, y: 0 });

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

        const data = await getChapterPages(chapterUrl, source, effectiveChapterId, effectiveBaseUrl || undefined, chapterNum || undefined);
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
    return () => { cancelled = true; };
  }, [source, id, chapterNum, effectiveBaseUrl, effectiveChapterId]);

  // Record reading history when images load
  useEffect(() => {
    if (images.length > 0 && !loading) {
      // Fetch manga title for history entry (non-blocking)
      getMangaDetail(id, source).then((detail) => {
        addHistory({
          mangaId: id,
          title: detail.manga.title,
          cover: detail.manga.cover,
          source,
          chapterNumber: Number(chapterNum),
        });
      }).catch(() => {
        // Still record without title — we'll use a fallback
        addHistory({
          mangaId: id,
          title: `Manga ${id.slice(0, 8)}`,
          cover: null,
          source,
          chapterNumber: Number(chapterNum),
        });
      });
    }
  }, [images.length, loading, id, source, chapterNum]);

  // Fetch chapter list for prev/next navigation
  useEffect(() => {
    let cancelled = false;
    getChapterList(id, source)
      .then(chs => { if (!cancelled) setChapters(chs); })
      .catch(() => {});
    return () => { cancelled = true; };
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
  const sortedAsc = [...chapters].sort((a, b) => Number(a.number) - Number(b.number));
  const currentAscIdx = sortedAsc.findIndex(ch => String(ch.number) === String(chapterNum));
  const prevChapter = currentAscIdx > 0 ? sortedAsc[currentAscIdx - 1] : null;
  const nextChapter = currentAscIdx >= 0 && currentAscIdx < sortedAsc.length - 1 ? sortedAsc[currentAscIdx + 1] : null;

  const buildChapterUrl = useCallback((ch: { number: string | number; id: string | number }) => {
    return `/manga/${source}/${encodeURIComponent(id)}/${ch.number}`;
  }, [source, id]);

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
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
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
    bubbleStartOffset.current = { x: e.clientX - rect.left - rect.width / 2, y: e.clientY - rect.top - rect.height / 2 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handleBubblePointerMove = useCallback((e: React.PointerEvent) => {
    if (!bubbleDragging.current) return;
    const dx = e.clientX - bubbleStartPos.current.x;
    const dy = e.clientY - bubbleStartPos.current.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) bubbleMoved.current = true;
    const clampedX = Math.max(16, Math.min(window.innerWidth - 72, e.clientX - bubbleStartOffset.current.x));
    const clampedY = Math.max(80, Math.min(window.innerHeight - 80, e.clientY - bubbleStartOffset.current.y));
    setBubblePos({ x: clampedX, y: clampedY });
  }, []);

  const handleBubblePointerUp = useCallback(() => {
    bubbleDragging.current = false;
    // If no drag happened, toggle the menu
    if (!bubbleMoved.current) {
      setBubbleExpanded((v) => !v);
    }
  }, []);

  const scrollToNextImage = useCallback(() => {
    const imgs = document.querySelectorAll("img[alt^='Halaman']");
    for (const img of Array.from(imgs)) {
      const rect = img.getBoundingClientRect();
      if (rect.top > 60) { img.scrollIntoView({ behavior: "smooth", block: "start" }); break; }
    }
  }, []);

  const scrollToPrevImage = useCallback(() => {
    const imgs = Array.from(document.querySelectorAll("img[alt^='Halaman']")).reverse();
    for (const img of imgs) {
      const rect = img.getBoundingClientRect();
      if (rect.bottom < window.innerHeight - 50 && rect.top < 0) { img.scrollIntoView({ behavior: "smooth", block: "start" }); break; }
    }
  }, []);

  // Reset to first image when switching to paged mode
  useEffect(() => {
    if (readingMode === "paged") {
      setCurrentPage(0);
    }
  }, [readingMode]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "ArrowLeft" && prevChapter) {
        e.preventDefault();
        window.location.href = buildChapterUrl(prevChapter);
      } else if (e.key === "ArrowRight" && nextChapter) {
        e.preventDefault();
        window.location.href = buildChapterUrl(nextChapter);
      } else if (readingMode === "paged") {
        if (e.key === "ArrowDown" || e.key === " ") {
          e.preventDefault();
          if (currentPage < images.length - 1) setCurrentPage(p => p + 1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          if (currentPage > 0) setCurrentPage(p => p - 1);
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
          const imgs = Array.from(document.querySelectorAll("img[alt^='Halaman']")).reverse();
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
  }, [prevChapter, nextChapter, buildChapterUrl, readingMode, currentPage, images.length]);

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-[var(--color-bg)]/95 backdrop-blur-sm border-b border-[var(--color-border)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-2.5">
          <Link
            href={mangaHref}
            className="flex items-center gap-1.5 text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors duration-150"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Kembali</span>
          </Link>

          <span className="text-[13px] font-semibold text-[var(--color-text)] select-none">
            Chapter {chapterNum}
          </span>

          <div className="flex items-center gap-1.5">
            {/* Reading settings */}
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] border border-transparent hover:border-[var(--color-border)] transition-colors duration-150 cursor-pointer"
                aria-label="Pengaturan bacaan"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </button>
              {settingsOpen && (
                <div className="absolute right-0 top-full mt-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3 shadow-lg z-50 w-56">
                  <p className="text-[11px] text-[var(--color-text-muted)] font-medium uppercase tracking-wider mb-2">Latar Belakang</p>
                  <div className="flex gap-2 mb-3">
                    {([
                      { key: "default" as const, color: "var(--color-bg)" },
                      { key: "dark" as const, color: "#000000" },
                      { key: "sepia" as const, color: "#d4c5a0" },
                      { key: "white" as const, color: "#ffffff" },
                    ]).map(({ key, color }) => (
                      <button
                        key={key}
                        onClick={() => setBgColor(key)}
                        className={`w-6 h-6 rounded-full border-2 transition-all duration-150 cursor-pointer ${
                          bgColor === key ? "border-[var(--color-accent)]" : "border-transparent"
                        } ${key === "white" ? "ring-1 ring-[var(--color-border)]" : ""}`}
                        style={{ backgroundColor: color }}
                        aria-label={`Latar ${key}`}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-[var(--color-text-muted)] font-medium uppercase tracking-wider mb-2">
                    Kecerahan: {Math.round(brightness * 100)}%
                  </p>
                  <input
                    type="range"
                    min={50}
                    max={100}
                    step={5}
                    value={Math.round(brightness * 100)}
                    onChange={(e) => setBrightness(Number(e.target.value) / 100)}
                    className="w-full accent-[var(--color-accent)]"
                  />
                </div>
              )}
            </div>

            {/* Keyboard shortcut hint */}
            <div className="group relative hidden sm:block">
              <button className="flex items-center justify-center w-6 h-6 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors duration-150 cursor-default" tabIndex={-1}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                  <path d="M12 17h.01"/>
                </svg>
              </button>
              <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute right-0 top-full mt-1 w-max px-3 py-1.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] shadow-lg text-[10px] text-[var(--color-text-muted)] whitespace-nowrap z-50">
                ← → prev/next chapter · ↑ ↓ scroll gambar · Space scroll ke bawah
              </div>
            </div>

            {/* Reading mode toggle */}
            <button
              onClick={() => setReadingMode(readingMode === "strip" ? "paged" : "strip")}
              className="flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] transition-colors duration-150 cursor-pointer"
              aria-label={`Ganti mode ke ${readingMode === "strip" ? "paged" : "strip"}`}
            >
              {readingMode === "strip" ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14"/>
                  <path d="M19 12l-7 7-7-7"/>
                  <path d="M5 12l7-7 7 7"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              )}
              {readingMode === "strip" ? "Strip" : "Paged"}
            </button>

            {/* Fit mode toggle */}
            <button
              onClick={() => setFitMode(fitMode === "width" ? "height" : "width")}
              className="flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] transition-colors duration-150 cursor-pointer"
              aria-label={`Ganti mode ke ${fitMode === "width" ? "height" : "width"}`}
            >
              {fitMode === "width" ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 3H3v18h18V3z" />
                  <path d="M3 9h18" />
                  <path d="M3 15h18" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 3H3v18h18V3z" />
                  <path d="M9 3v18" />
                  <path d="M15 3v18" />
                </svg>
              )}
              {fitMode === "width" ? "Lebar" : "Tinggi"}
            </button>
          </div>
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="text-center py-20 px-4">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4"/>
              <path d="M12 16h.01"/>
            </svg>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] mb-1">Gagal: {error}</p>
          <p className="text-[12px] text-[var(--color-text-muted)]">Coba buka manual: {effectiveBaseUrl}/chapter-{chapterNum}</p>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && images.length === 0 && (
        <div className="text-center py-20">
          <p className="text-[var(--color-text-muted)] text-sm">
            Tidak ada gambar ditemukan. Site mungkin block scraper atau URL salah.
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && <SkeletonLoader />}

      {/* Images — strip mode */}
      {!loading && !error && images.length > 0 && readingMode === "strip" && (
        <div className={`flex flex-col items-center ${bgColor === "dark" ? "bg-black" : bgColor === "sepia" ? "bg-[#d4c5a0]" : bgColor === "white" ? "bg-white" : ""}`}>
          {images.map((src, i) => {
            const loaded = loadedImages.has(i);
            return (
              <div key={i} className="relative w-full max-w-3xl mx-auto" style={brightness < 1 ? { filter: `brightness(${brightness})` } : undefined}>
                <div
                  className={`skeleton w-full aspect-[3/4] rounded-lg transition-opacity duration-300 ${
                    loaded ? "opacity-0 absolute inset-0" : "opacity-100"
                  }`}
                  style={{ animationDelay: `${(i % 6) * 150}ms` }}
                />
                <img
                  src={src}
                  alt={`Halaman ${i + 1}`}
                  className={`w-full object-contain transition-opacity duration-500 ${
                    loaded ? "opacity-100" : "opacity-0"
                  }`}
                  style={{
                    maxWidth: fitMode === "width" ? "48rem" : undefined,
                    height: fitMode === "height" ? "100dvh" : "auto",
                    width: fitMode === "height" ? "auto" : undefined,
                    objectFit: "contain",
                  }}
                  loading={i === 0 ? "eager" : "lazy"}
                  onLoad={() => {
                    setLoadedImages(prev => {
                      const next = new Set(prev);
                      next.add(i);
                      return next;
                    });
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Images — paged mode */}
      {!loading && !error && images.length > 0 && readingMode === "paged" && (
        <div className={`flex flex-col items-center min-h-[70dvh] ${bgColor === "dark" ? "bg-black" : bgColor === "sepia" ? "bg-[#d4c5a0]" : bgColor === "white" ? "bg-white" : ""}`}>
          <div className="relative w-full max-w-3xl mx-auto flex items-center justify-center" style={brightness < 1 ? { filter: `brightness(${brightness})` } : undefined}>
            <img
              src={images[currentPage]}
              alt={`Halaman ${currentPage + 1}`}
              className="w-full object-contain cursor-pointer"
              style={{
                maxWidth: fitMode === "width" ? "48rem" : undefined,
                height: fitMode === "height" ? "100dvh" : "auto",
                width: fitMode === "height" ? "auto" : undefined,
                objectFit: "contain",
              }}
              loading="eager"
              onLoad={() => {
                setLoadedImages(prev => {
                  const next = new Set(prev);
                  next.add(currentPage);
                  return next;
                });
              }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                if (clickX < rect.width / 2) {
                  if (currentPage > 0) setCurrentPage(p => p - 1);
                } else {
                  if (currentPage < images.length - 1) setCurrentPage(p => p + 1);
                }
              }}
            />
          </div>

          <div className="flex items-center justify-center gap-4 py-4">
            <button
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className={`flex items-center gap-1.5 text-[13px] px-4 py-2 rounded-lg border transition-all duration-150 cursor-pointer ${
                currentPage === 0
                  ? "bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text-muted)] opacity-40 cursor-not-allowed"
                  : "bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)]"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
              </svg>
              Prev
            </button>

            <span className="text-[13px] text-[var(--color-text-secondary)] tabular-nums select-none">
              Halaman {currentPage + 1} / {images.length}
            </span>

            {currentPage < images.length - 1 ? (
              <button
                onClick={() => setCurrentPage(p => p + 1)}
                className="flex items-center gap-1.5 text-[13px] px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-all duration-150 shadow-md shadow-[var(--color-accent-dim)] cursor-pointer"
              >
                Next
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
                </svg>
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-[13px] text-[var(--color-text-muted)] italic">Chapter selesai</span>
                {prevChapter && (
                  <button
                    onClick={() => { window.location.href = buildChapterUrl(prevChapter); }}
                    className="flex items-center gap-1.5 text-[13px] px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-all duration-150 shadow-md shadow-[var(--color-accent-dim)] cursor-pointer"
                  >
                    Prev Chapter
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom nav — only in strip mode */}
      {!loading && !error && images.length > 0 && readingMode === "strip" && (
        <>
          {/* Gradient fade from content to footer */}
          <div className="h-24 bg-gradient-to-b from-transparent to-[var(--color-bg)]" />

          <div className="w-full border-t border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="max-w-4xl mx-auto flex flex-col items-center gap-6 py-10 px-4">
              <p className="text-sm font-semibold text-[var(--color-text)] tracking-wide uppercase">
                Chapter {chapterNum} selesai
              </p>

              <Link
                href={mangaHref}
                className="flex items-center gap-2 text-sm font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors duration-150 hover:underline underline-offset-4 decoration-[var(--color-accent)]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                    className="px-5 py-2.5 text-[13px] font-medium rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] transition-all duration-150"
                  >
                    &larr; Prev
                  </Link>
                ) : (
                  <span className="px-5 py-2.5 text-[13px] font-medium rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-muted)] opacity-40 cursor-not-allowed select-none pointer-events-none">
                    &larr; Prev
                  </span>
                )}
                {nextChapter ? (
                  <Link
                    href={buildChapterUrl(nextChapter)}
                    className="px-5 py-2.5 text-[13px] font-medium rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-all duration-150 shadow-md shadow-[var(--color-accent-dim)]"
                  >
                    Next &rarr;
                  </Link>
                ) : (
                  <span className="px-5 py-2.5 text-[13px] font-medium rounded-lg bg-[var(--color-accent)] text-white opacity-40 cursor-not-allowed select-none pointer-events-none">
                    Next &rarr;
                  </span>
                )}
              </div>
            </div>
          </div>
        </>
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
            <div 
              className="absolute bottom-full mb-2 right-0 flex flex-col items-end gap-2 animate-[fadeIn_0.15s_ease]"
            >
              {/* Prev chapter */}
              {prevChapter && (
                <button
                  onClick={() => { window.location.href = buildChapterUrl(prevChapter); setBubbleExpanded(false); }}
                  className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] shadow-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors duration-150 cursor-pointer"
                >
                  <span className="text-[11px] font-medium whitespace-nowrap">Chapter Prev</span>
                  <span className="w-7 h-7 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
                    </svg>
                  </span>
                </button>
              )}
              {/* Next chapter */}
              {nextChapter && (
                <button
                  onClick={() => { window.location.href = buildChapterUrl(nextChapter); setBubbleExpanded(false); }}
                  className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] shadow-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors duration-150 cursor-pointer"
                >
                  <span className="text-[11px] font-medium whitespace-nowrap">Chapter Next</span>
                  <span className="w-7 h-7 rounded-full bg-[var(--color-accent-dim)] flex items-center justify-center text-[var(--color-accent)]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
                    </svg>
                  </span>
                </button>
              )}
              {/* Scroll up */}
              <button
                onClick={() => { scrollToPrevImage(); setBubbleExpanded(false); }}
                className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] shadow-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors duration-150 cursor-pointer"
              >
                <span className="text-[11px] font-medium whitespace-nowrap">Scroll Atas</span>
                <span className="w-7 h-7 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 15l-6-6-6 6"/>
                  </svg>
                </span>
              </button>
              {/* Scroll down */}
              <button
                onClick={() => { scrollToNextImage(); setBubbleExpanded(false); }}
                className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] shadow-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors duration-150 cursor-pointer"
              >
                <span className="text-[11px] font-medium whitespace-nowrap">Scroll Bawah</span>
                <span className="w-7 h-7 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </span>
              </button>
              {/* Go to detail */}
              <Link
                href={mangaHref}
                onClick={() => setBubbleExpanded(false)}
                className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] shadow-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors duration-150"
              >
                <span className="text-[11px] font-medium whitespace-nowrap">Detail</span>
                <span className="w-7 h-7 rounded-full bg-[var(--color-accent-dim)] flex items-center justify-center text-[var(--color-accent)]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </span>
              </Link>
            </div>
          )}

          {/* Main bubble button */}
          <div
            className="w-12 h-12 rounded-full bg-[var(--color-surface)]/90 backdrop-blur-sm border border-[var(--color-border)] shadow-lg shadow-black/20 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] transition-colors duration-150 cursor-pointer select-none touch-none"
            style={{ opacity: bubbleExpanded ? 1 : 0.7 }}
            onPointerDown={handleBubblePointerDown}
            onPointerMove={handleBubblePointerMove}
            onPointerUp={handleBubblePointerUp}
          >
            {bubbleExpanded ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1"/>
                <circle cx="12" cy="5" r="1"/>
                <circle cx="12" cy="19" r="1"/>
              </svg>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
