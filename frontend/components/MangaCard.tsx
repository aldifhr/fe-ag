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
  chapters?: { number: string; time: string | null }[];
}

export default function MangaCard({ title, cover, source, id, chapter, time, chapters }: Props) {
  const [imgErr, setImgErr] = useState(false);
  const [fav, setFav] = useState(() => isFavorite(id));
  const [imgLoaded, setImgLoaded] = useState(false);

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
    <div className="group block rounded-lg overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-colors duration-200">
      {/* Cover + Title — link to manga detail */}
      <Link href={`/manga/${source}/${encodeURIComponent(id)}`} className="block">
        {/* Cover */}
        <div className="aspect-[3/4] relative overflow-hidden bg-[var(--color-surface)]">
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
              <img
                src={cover}
                alt={title}
                className={`w-full h-full object-cover transition-opacity duration-300 group-hover:scale-[1.03] ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                onError={() => setImgErr(true)}
                onLoad={() => setImgLoaded(true)}
                loading="lazy"
              />
              {!imgLoaded && (
                <div className="absolute inset-0 skeleton" />
              )}
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

      {/* Chapter list — each chapter is a link to reader */}
      {chapters && chapters.length > 0 ? (
        <div className="px-3 pb-2.5 flex flex-col gap-0.5">
          {chapters.map((ch, i) => (
            <Link
              key={i}
              href={`/manga/${source}/${encodeURIComponent(id)}/${ch.number}`}
              className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              Ch. {ch.number} {ch.time ? `· ${timeAgo(new Date(ch.time).getTime())}` : ""}
            </Link>
          ))}
        </div>
      ) : chapter ? (
        <div className="px-3 pb-2.5">
          <Link
            href={`/manga/${source}/${encodeURIComponent(id)}/${chapter}`}
            className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            Ch. {chapter} {time ? `· ${timeAgo(new Date(time).getTime())}` : ""}
          </Link>
        </div>
      ) : null}

      {/* Source badge */}
      <div className="px-3 pb-2.5">
        <span className="inline-block px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded text-[var(--color-text-muted)] bg-[var(--color-surface-hover)]">
          {source}
        </span>
      </div>
    </div>
  );
}
