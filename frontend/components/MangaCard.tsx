"use client";
import React from "react";
import Link from "next/link";
import { useState, useMemo } from "react";
import { timeAgo, getReadChapters, getReadingProgress } from "@/lib/history";
import { proxyCover } from "@/lib/api";
import { normalizeStatus } from "@/lib/normalizeStatus";
import { useFavoriteToggle } from "@/lib/hooks/useFavoriteToggle";
import HeartIcon from "./HeartIcon";

interface Props {
  title: string;
  cover: string | null;
  source: string;
  id: string;
  chapter?: string;
  time?: string;
  status?: string | number | null;
  rating?: string | number | null;
  chapters?: { number: string; time: string | null }[];
}

/** Normalize chapter display: always returns "Ch. X" format. */
function chapterLabel(raw: string): string {
  const stripped = raw.replace(/^chapter\s+/i, "").replace(/^ch\.?\s*/i, "").trim();
  return `Chapter ${stripped}`;
}

/** Extract numeric part from chapter string for history lookup. */
function chapterNum(raw: string): string {
  return raw.replace(/^chapter\s+/i, "").replace(/^ch\.?\s*/i, "");
}

function MangaCard({
  title,
  cover,
  source,
  id,
  chapter,
  time,
  status,
  rating,
  chapters,
}: Props) {
  const [imgErr, setImgErr] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const { fav, toggle: toggleFav } = useFavoriteToggle(id, { title, cover, source });

  // Normalize status
  const normalized = normalizeStatus(status);
  const statusLabel = normalized?.label ?? null;
  const statusColor =
    statusLabel === "Ongoing"
      ? "bg-emerald-400"
      : statusLabel === "Completed"
        ? "bg-gray-400"
        : statusLabel === "Hiatus"
          ? "bg-yellow-400"
          : "";

  // Normalize rating
  const ratingNum = rating != null && rating !== "" ? Number(rating) : null;
  const hasRating = ratingNum !== null && !isNaN(ratingNum) && ratingNum > 0;

  const isNew = time
    ? Date.now() - new Date(time).getTime() < 24 * 60 * 60 * 1000
    : false;

  const readChapters = useMemo(() => getReadChapters(id), [id]);
  const progress = useMemo(() => getReadingProgress(id), [id]);

  const handleFav = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFav();
  };

  return (
    <div className="group flex flex-col rounded-lg overflow-hidden bg-(--color-surface) border border-(--color-border) hover:border-(--color-border-hover) transition-colors duration-200 min-h-65">
      {/* Cover + Title — link to manga detail */}
      <Link
        href={`/manga/${source}/${encodeURIComponent(id)}`}
        className="block"
      >
        {/* Cover */}
        <div className="aspect-3/4 relative overflow-hidden bg-(--color-surface)">
          {/* "Baru" badge */}
          {isNew && (
            <span className="absolute top-2 left-2 z-10 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-(--color-accent) text-white">
              Baru
            </span>
          )}

          {/* Bookmark toggle */}
          <button
            onClick={handleFav}
            className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-black/50 border border-white/10 hover:bg-black/70 transition-colors duration-150"
            aria-label={fav ? "Hapus dari favorit" : "Tambah ke favorit"}
          >
            <HeartIcon
              filled={fav}
              className={fav ? "text-(--color-danger)" : "text-white/60"}
            />
          </button>

          {/* Source flag — bottom-left */}
          <img
            src={source === "ikiru" ? "https://flagsapi.com/JP/flat/64.png" : "https://flagsapi.com/KR/flat/64.png"}
            alt={source === "ikiru" ? "Japan" : "Korea"}
            className="absolute bottom-2 left-2 z-10 w-5 h-[15px] rounded-[2px] shadow-md object-cover"
          />

          {/* Source name badge — bottom-right */}
          <span className={`absolute bottom-2 right-2 z-10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider rounded backdrop-blur-sm ${
            source === "shinigami"
              ? "bg-black text-red-400"
              : "bg-emerald-600 text-white"
          }`}>
            {source === "ikiru" ? "Ikiru" : "Shinigami"}
          </span>

          {cover && !imgErr ? (
            <img
              src={proxyCover(cover)}
              alt={title}
              className="relative w-full h-full object-cover transition-[filter,transform] duration-300 group-hover:scale-[1.03]"
              style={{
                filter: imgLoaded ? "none" : "blur(10px)",
                transform: imgLoaded ? "none" : "scale(1.1)",
              }}
              onError={() => setImgErr(true)}
              onLoad={() => setImgLoaded(true)}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-(--color-surface) text-(--color-text-muted) text-sm p-3 text-center leading-relaxed">
              {title}
            </div>
          )}
        </div>

        {/* Title */}
        <div className="px-3 py-2.5">
          <h3 className="text-[13px] font-medium leading-snug line-clamp-2 text-(--color-text) group-hover:text-(--color-text-secondary) transition-colors duration-150">
            {title}
          </h3>
        </div>
      </Link>

      {/* Chapter list — flex-1 pushes badges to bottom */}
      <div className="px-3 pb-2.5 flex-1 flex flex-col gap-1 justify-start">
        {chapters && chapters.length > 0 ? (
          chapters.map((ch, i) => {
            const isRead = readChapters.has(chapterNum(ch.number));
            return (
              <Link
                key={i}
                href={`/manga/${source}/${encodeURIComponent(id)}/${ch.number}`}
                className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors duration-150 w-fit ${
                  isRead
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "bg-(--color-bg) text-(--color-text-secondary) border border-(--color-border) hover:text-(--color-accent) hover:border-(--color-accent)/40 hover:bg-(--color-accent)/5"
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                {isRead && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {chapterLabel(ch.number)}
                {ch.time && (
                  <span className="opacity-60">
                    · {timeAgo(new Date(ch.time).getTime())}
                  </span>
                )}
              </Link>
            );
          })
        ) : chapter ? (
          (() => {
            const isRead = readChapters.has(chapterNum(chapter));
            return (
              <Link
                href={`/manga/${source}/${encodeURIComponent(id)}/${chapter}`}
                className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors duration-150 w-fit ${
                  isRead
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "bg-(--color-bg) text-(--color-text-secondary) border border-(--color-border) hover:text-(--color-accent) hover:border-(--color-accent)/40 hover:bg-(--color-accent)/5"
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                {isRead && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {chapterLabel(chapter)}
                {time && (
                  <span className="opacity-60">
                    · {timeAgo(new Date(time).getTime())}
                  </span>
                )}
              </Link>
            );
          })()
        ) : null}

        {/* Reading progress */}
        {progress && (
          progress.total > 0 ? (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-[3px] rounded-full bg-(--color-border) overflow-hidden">
                <div
                  className="h-full rounded-full bg-(--color-accent)"
                  style={{ width: `${Math.min(100, (progress.read / progress.total) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-(--color-text-muted) tabular-nums shrink-0">
                {progress.read}/{progress.total}
              </span>
            </div>
          ) : progress.read > 0 ? (
            <p className="text-[10px] text-(--color-text-muted) mt-1">
              {progress.read} chapters read
            </p>
          ) : null
        )}
      </div>

      {/* Rating + Status badges — always at bottom */}
      <div className="px-3 pb-2.5 flex items-center gap-1.5 flex-wrap">
        {hasRating && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded text-amber-500 bg-amber-500/10">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            {ratingNum!.toFixed(1)}
          </span>
        )}
        {statusLabel && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded text-(--color-text-muted) bg-(--color-surface-hover)">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor}`}
            />
            {statusLabel}
          </span>
        )}
      </div>
    </div>
  );
}

export default React.memo(MangaCard);
