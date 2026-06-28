"use client";
import { useEffect } from "react";
import { proxyImage } from "@/lib/api";
import { SkeletonLoader } from "./SkeletonLoader";
import { useZoomPan } from "./useZoomPan";

interface ImageStripProps {
  images: string[];
  loading: boolean;
  error: string | null;
  bgColor: "default" | "dark" | "sepia" | "white";
  brightness: number;
  loadedImagesRef: React.RefObject<Set<number>>;
  markImageLoaded: (idx: number) => void;
  retryKeys: Map<number, number>;
  setRetryKeys: React.Dispatch<React.SetStateAction<Map<number, number>>>;
  effectiveBaseUrl: string;
  chapterNum: string;
}

export function ImageStrip({
  images,
  loading,
  error,
  bgColor,
  brightness,
  loadedImagesRef,
  markImageLoaded,
  retryKeys,
  setRetryKeys,
  effectiveBaseUrl,
  chapterNum,
}: ImageStripProps) {
  const {
    zoomLevel,
    zoomOrigin,
    zoomedImageIdx,
    panOffset,
    pinchActiveRef,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleWheel,
    resetZoom,
  } = useZoomPan();

  // Reset pinch-to-zoom when zoomed image scrolls out of viewport
  useEffect(() => {
    if (zoomedImageIdx === null) return;
    const idx = zoomedImageIdx;
    function checkScroll() {
      if (pinchActiveRef.current) return;
      const imgs = document.querySelectorAll("img[alt^='Halaman']");
      const img = imgs[idx] as HTMLElement | undefined;
      if (!img) {
        resetZoom();
        return;
      }
      const rect = img.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        resetZoom();
      }
    }
    window.addEventListener("scroll", checkScroll, { passive: true });
    return () => window.removeEventListener("scroll", checkScroll);
  }, [zoomedImageIdx, resetZoom, pinchActiveRef]);

  return (
    <>
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
          className={`flex flex-col items-center select-none ${bgColor === "dark" ? "bg-black" : bgColor === "sepia" ? "bg-[#d4c5a0]" : bgColor === "white" ? "bg-white" : ""}`}
          style={{ touchAction: "pan-y" }}
        >
          {images.map((src, i) => {
            const loaded = loadedImagesRef.current.has(i);
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
                onTouchStart={(e) => handleTouchStart(e, i)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onWheel={handleWheel}
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
                  onLoad={() => markImageLoaded(i)}
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
    </>
  );
}
