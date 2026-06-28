import { proxyImage } from "@/lib/api";
import { SkeletonLoader } from "./SkeletonLoader";

interface ImageStripProps {
  images: string[];
  loading: boolean;
  error: string | null;
  bgColor: "default" | "dark" | "sepia" | "white";
  brightness: number;
  loadedImages: Set<number>;
  setLoadedImages: React.Dispatch<React.SetStateAction<Set<number>>>;
  retryKeys: Map<number, number>;
  setRetryKeys: React.Dispatch<React.SetStateAction<Map<number, number>>>;
  zoomLevel: number;
  setZoomLevel: (v: number) => void;
  zoomLevelRef: React.RefObject<number>;
  zoomOrigin: { x: number; y: number };
  setZoomOrigin: (v: { x: number; y: number }) => void;
  zoomedImageIdx: number | null;
  setZoomedImageIdx: (v: number | null) => void;
  panOffset: { x: number; y: number };
  setPanOffset: (v: { x: number; y: number }) => void;
  panOffsetRef: React.RefObject<{ x: number; y: number }>;
  lastTapRef: React.RefObject<{ time: number; idx: number }>;
  pinchStartRef: React.RefObject<{ dist: number; zoom: number }>;
  panStartRef: React.RefObject<{ x: number; y: number; ox: number; oy: number }>;
  pinchActiveRef: React.RefObject<boolean>;
  stripDragRef: React.RefObject<{ dragging: boolean; startY: number; startScrollY: number }>;
  effectiveBaseUrl: string;
  chapterNum: string;
}

export function ImageStrip({
  images,
  loading,
  error,
  bgColor,
  brightness,
  loadedImages,
  setLoadedImages,
  retryKeys,
  setRetryKeys,
  zoomLevel,
  setZoomLevel,
  zoomLevelRef,
  zoomOrigin,
  setZoomOrigin,
  zoomedImageIdx,
  setZoomedImageIdx,
  panOffset,
  setPanOffset,
  panOffsetRef,
  lastTapRef,
  pinchStartRef,
  panStartRef,
  pinchActiveRef,
  stripDragRef,
  effectiveBaseUrl,
  chapterNum,
}: ImageStripProps) {
  // Strip mode drag-to-scroll (disabled during pinch) — moved from page.tsx
  // ponytail: extract to custom hook if more strip-drag logic is added
  function handleStripPointerDown(e: React.PointerEvent) {
    if (e.button !== 0 || pinchActiveRef.current) return;
    stripDragRef.current = {
      dragging: true,
      startY: e.clientY,
      startScrollY: window.scrollY,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleStripPointerMove(e: React.PointerEvent) {
    if (!stripDragRef.current.dragging || pinchActiveRef.current) return;
    const delta = e.clientY - stripDragRef.current.startY;
    window.scrollTo(0, stripDragRef.current.startScrollY - delta);
  }

  function handleStripPointerUp() {
    stripDragRef.current = { ...stripDragRef.current, dragging: false };
  }

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
                    stripDragRef.current = { ...stripDragRef.current, dragging: false };
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
    </>
  );
}
