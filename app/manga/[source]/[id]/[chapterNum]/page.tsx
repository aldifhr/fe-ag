"use client";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { ReaderHeader } from "./reader/ReaderHeader";
import { ImageStrip } from "./reader/ImageStrip";
import { ReaderBottomNav } from "./reader/ReaderBottomNav";
import { FloatingBubble } from "./reader/FloatingBubble";
import { useReaderState } from "./reader/useReaderState";

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

  const state = useReaderState({
    source,
    id,
    chapterNum,
    effectiveBaseUrl,
    effectiveChapterId,
  });

  return (
    <div
      className={`min-h-screen ${state.nightMode ? "bg-black" : ""}`}
      onClick={state.handleNightTap}
    >
      {state.nightMode && (
        <div className="fixed inset-0 bg-black/70 z-40 pointer-events-none transition-opacity duration-300" />
      )}

      <ReaderHeader
        mangaHref={state.mangaHref}
        chapterNum={chapterNum}
        chromeHidden={state.chromeHidden}
        bgColor={state.bgColor}
        setBgColor={state.setBgColor}
        brightness={state.brightness}
        setBrightness={state.setBrightness}
        nightMode={state.nightMode}
        setNightMode={state.setNightMode}
        settingsOpen={state.settingsOpen}
        setSettingsOpen={state.setSettingsOpen}
        settingsRef={state.settingsRef}
        scrollProgress={state.scrollProgress}
        mangaTitle={state.mangaTitle}
      />

      <ImageStrip
        images={state.images}
        loading={state.loading}
        error={state.error}
        bgColor={state.bgColor}
        brightness={state.brightness}
        loadedImagesRef={state.loadedImagesRef}
        markImageLoaded={state.markImageLoaded}
        retryKeys={state.retryKeys}
        setRetryKeys={state.setRetryKeys}
        effectiveBaseUrl={effectiveBaseUrl}
        chapterNum={chapterNum}
      />

      <ReaderBottomNav
        loading={state.loading}
        error={state.error}
        images={state.images}
        chromeHidden={state.chromeHidden}
        chapterNum={chapterNum}
        mangaHref={state.mangaHref}
        prevChapter={state.prevChapter}
        nextChapter={state.nextChapter}
        buildChapterUrl={state.buildChapterUrl}
      />

      <FloatingBubble
        chromeHidden={state.chromeHidden}
        bubblePos={state.bubblePos}
        bubbleExpanded={state.bubbleExpanded}
        setBubbleExpanded={state.setBubbleExpanded}
        prevChapter={state.prevChapter}
        nextChapter={state.nextChapter}
        buildChapterUrl={state.buildChapterUrl}
        scrollToPrevImage={state.scrollToPrevImage}
        scrollToNextImage={state.scrollToNextImage}
        mangaHref={state.mangaHref}
        handleBubblePointerDown={state.handleBubblePointerDown}
        handleBubblePointerMove={state.handleBubblePointerMove}
        handleBubblePointerUp={state.handleBubblePointerUp}
      />
    </div>
  );
}
