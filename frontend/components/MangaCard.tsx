"use client";
import Link from "next/link";
import { useState } from "react";
import { isFavorite, addFavorite, removeFavorite } from "@/lib/favorites";
import { showToast } from "@/lib/toast";
import { timeAgo } from "@/lib/history";

interface Props {
  title: string;
  cover: string | null;
  source: string;
  id: string;
  chapter?: string;
  time?: string;
  status?: string | number | null;
  chapters?: { number: string; time: string | null }[];
}

export default function MangaCard({ title, cover, source, id, chapter, time, status, chapters }: Props) {
  const [imgErr, setImgErr] = useState(false);
  const [fav, setFav] = useState(() => isFavorite(id));
  const [imgLoaded, setImgLoaded] = useState(false);
  const blurBase64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsMDQ4SEA0OEQ4LCxAWEBETFBUVFQ4PFx8WFBgSFBUU/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBL/wAARCAAEAAQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAFRABAQAAAAAAAAAAAAAAAAAAAAf/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=";

  // Normalize status
  const statusLabel: string | null =
    typeof status === "number"
      ? status === 1 ? "Ongoing" : status === 2 ? "Completed" : status === 3 ? "Hiatus" : null
      : typeof status === "string"
        ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
        : null;
  const statusColor =
    statusLabel === "Ongoing" ? "bg-emerald-400"
    : statusLabel === "Completed" ? "bg-gray-400"
    : statusLabel === "Hiatus" ? "bg-yellow-400"
    : "";

  // "Baru" badge: updated within 24h
  const isNew = time ? (Date.now() - new Date(time).getTime()) < 24 * 60 * 60 * 1000 : false;

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
    <div className="group flex flex-col rounded-lg overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-colors duration-200 min-h-[260px]">
      {/* Cover + Title — link to manga detail */}
      <Link href={`/manga/${source}/${encodeURIComponent(id)}`} className="block">
        {/* Cover */}
        <div className="aspect-[3/4] relative overflow-hidden bg-[var(--color-surface)]">
          {/* "Baru" badge */}
          {isNew && (
            <span className="absolute top-2 left-2 z-10 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-[var(--color-accent)] text-white">
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-[var(--color-danger)]">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/60">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            )}
          </button>

          {cover && !imgErr ? (
            <>
              {/* Blur placeholder */}
              <div
                className="absolute inset-0 transition-opacity duration-500"
                style={{
                  backgroundImage: `url(${blurBase64})`,
                  backgroundSize: 'cover',
                  filter: 'blur(20px)',
                  opacity: imgLoaded ? 0 : 1,
                }}
              />
              <img
                src={cover}
                alt={title}
                className={`relative w-full h-full object-cover transition-opacity duration-500 group-hover:scale-[1.03] ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                onError={() => setImgErr(true)}
                onLoad={() => setImgLoaded(true)}
                loading="lazy"
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[var(--color-surface)] text-[var(--color-text-muted)] text-sm p-3 text-center leading-relaxed">
              {title}
            </div>
          )}
        </div>

        {/* Title */}
        <div className="px-3 py-2.5">
          <h3 className="text-[13px] font-medium leading-snug line-clamp-2 text-[var(--color-text)] group-hover:text-[var(--color-text-secondary)] transition-colors duration-150">
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
              className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              Ch. {ch.number} {ch.time ? `· ${timeAgo(new Date(ch.time).getTime())}` : ""}
            </Link>
          ))
        ) : chapter ? (
          <Link
            href={`/manga/${source}/${encodeURIComponent(id)}/${chapter}`}
            className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            Ch. {chapter} {time ? `· ${timeAgo(new Date(time).getTime())}` : ""}
          </Link>
        ) : null}
      </div>

      {/* Source + Status badges — always at bottom */}
      <div className="px-3 pb-2.5 flex items-center gap-1.5 flex-wrap">
        <span className="inline-block px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded text-[var(--color-text-muted)] bg-[var(--color-surface-hover)]">
          {source}
        </span>
        {statusLabel && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded text-[var(--color-text-muted)] bg-[var(--color-surface-hover)]">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor}`} />
            {statusLabel}
          </span>
        )}
      </div>
    </div>
  );
}
