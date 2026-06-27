"use client";
import Link from "next/link";
import { useState } from "react";
import { isFavorite, addFavorite, removeFavorite } from "@/lib/favorites";
import { showToast } from "@/lib/toast";
import { timeAgo } from "@/lib/history";
import { proxyCover } from "@/lib/api";

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

export default function MangaCard({
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
  const [fav, setFav] = useState(() => isFavorite(id));
  const [imgLoaded, setImgLoaded] = useState(false);

  // Normalize status
  const statusLabel: string | null =
    typeof status === "number"
      ? status === 1
        ? "Ongoing"
        : status === 2
          ? "Completed"
          : status === 3
            ? "Hiatus"
            : null
      : typeof status === "string"
        ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
        : null;
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

  function toggleFav(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    if (fav) {
      removeFavorite(id);
      setFav(false);
      showToast("Dihapus dari bookmark");
    } else {
      addFavorite({ id, title, cover, source });
      setFav(true);
      showToast("Ditambahkan ke bookmark");
    }
  }

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
            onClick={toggleFav}
            className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-black/50 border border-white/10 hover:bg-black/70 transition-colors duration-150"
            aria-label={fav ? "Hapus dari favorit" : "Tambah ke favorit"}
          >
            {fav ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-(--color-danger)"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white/60"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            )}
          </button>

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
      <div className="px-3 pb-2.5 flex-1 flex flex-col gap-0.5 justify-start">
        {chapters && chapters.length > 0 ? (
          chapters.map((ch, i) => (
            <Link
              key={i}
              href={`/manga/${source}/${encodeURIComponent(id)}/${ch.number}`}
              className="text-[11px] text-(--color-text-muted) hover:text-(--color-accent) transition-colors duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              Ch. {ch.number}{" "}
              {ch.time ? `· ${timeAgo(new Date(ch.time).getTime())}` : ""}
            </Link>
          ))
        ) : chapter ? (
          <Link
            href={`/manga/${source}/${encodeURIComponent(id)}/${chapter}`}
            className="text-[11px] text-(--color-text-muted) hover:text-(--color-accent) transition-colors duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            Ch. {chapter} {time ? `· ${timeAgo(new Date(time).getTime())}` : ""}
          </Link>
        ) : null}
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
