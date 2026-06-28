import Link from "next/link";
import { proxyCover } from "@/lib/api";
import type { MangaDetail } from "@/lib/api";
import { addFavorite, removeFavorite } from "@/lib/favorites";
import { showToast } from "@/lib/toast";
import { cleanDescription } from "@/lib/descriptionFilter";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

interface DetailHeroProps {
  manga: MangaDetail["manga"];
  id: string;
  fav: boolean;
  setFav: (v: boolean) => void;
  descExpanded: boolean;
  setDescExpanded: (v: boolean | ((p: boolean) => boolean)) => void;
}

export function DetailHero({ manga, id, fav, setFav, descExpanded, setDescExpanded }: DetailHeroProps) {
  const uniqueGenres = [...new Set(manga.genres ?? [])];
  const isOngoing = String(manga.status ?? "").toLowerCase() === "ongoing";

  return (
    <SectionErrorBoundary>
      <div className="flex flex-col md:flex-row gap-6 md:gap-8 mb-10">
        {/* Cover */}
        <div className="w-36 md:w-48 shrink-0 mx-auto md:mx-0">
          {manga.cover ? (
            <img
              src={proxyCover(manga.cover)}
              alt={manga.title}
              className="w-full rounded-lg shadow-lg shadow-black/30"
            />
          ) : (
            <div className="w-full aspect-3/4 bg-(--color-surface) rounded-lg flex items-center justify-center text-(--color-text-muted) text-sm border border-(--color-border)">
              No Cover
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap mb-2">
            <h1 className="text-2xl md:text-3xl font-bold leading-tight tracking-tight">
              {manga.title}
            </h1>

          </div>

          {/* Alternative title */}
          {manga.alternative_title && (
            <p className="text-[12px] text-(--color-text-muted) mb-2 italic">
              {manga.alternative_title}
            </p>
          )}

          {/* Bookmark */}
          <button
            onClick={() => {
              if (fav) {
                removeFavorite(id);
                setFav(false);
                showToast("Dihapus dari bookmark");
              } else {
                addFavorite({
                  id,
                  title: manga.title,
                  cover: manga.cover,
                  source: manga.source,
                });
                setFav(true);
                showToast("Ditambahkan ke bookmark");
              }
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors duration-150 mb-3 ${
              fav
                ? "bg-(--color-danger)/10 text-(--color-danger) border border-(--color-danger)/20"
                : "bg-(--color-surface) text-(--color-text-muted) border border-(--color-border) hover:border-(--color-border-hover) hover:text-(--color-text-secondary)"
            }`}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill={fav ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            {fav ? "Tersimpan" : "Bookmark"}
          </button>

          {/* Share */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              showToast("Link disalin!");
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors duration-150 mb-3 bg-(--color-surface) text-(--color-text-muted) border border-(--color-border) hover:border-(--color-border-hover) hover:text-(--color-text-secondary) cursor-pointer"
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
              <path d="M18 8A3 3 0 1 0 18 2a3 3 0 0 0 0 6z" />
              <path d="M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
              <path d="M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Bagikan
          </button>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-3 text-[12px]">
            {manga.user_rate && (
              <div className="flex items-center gap-1">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="text-yellow-400"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span className="text-(--color-text) font-medium">
                  {Number(manga.user_rate).toFixed(1)}
                </span>
              </div>
            )}
            {manga.view_count != null && (
              <div className="flex items-center gap-1 text-(--color-text-muted)">
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span>{formatNumber(manga.view_count)} views</span>
              </div>
            )}
            {manga.bookmark_count != null && (
              <div className="flex items-center gap-1 text-(--color-text-muted)">
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                <span>{formatNumber(manga.bookmark_count)}</span>
              </div>
            )}
            {manga.release_year && (
              <span className="text-(--color-text-muted)">
                {manga.release_year}
              </span>
            )}
            {manga.country_id && (
              <span className="text-(--color-text-muted)">
                {manga.country_id}
              </span>
            )}
          </div>

          {/* Status */}
          {manga.status && (
            <div className="flex items-center gap-2 mb-3">
              <span
                className={`w-2 h-2 rounded-full ${isOngoing ? "bg-(--color-success)" : "bg-(--color-text-muted)"}`}
              />
              <span className="text-[13px] text-(--color-text-secondary) capitalize">
                {manga.status}
              </span>
            </div>
          )}

          {/* Genres */}
          {uniqueGenres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {uniqueGenres.map((g, i) => (
                <Link
                  key={`${g}-${i}`}
                  href={`/genres/${g.toLowerCase().replace(/\s+/g, "-")}`}
                  className="px-2 py-0.5 text-[11px] font-medium rounded bg-(--color-surface) border border-(--color-border) text-(--color-text-secondary) hover:text-(--color-accent) hover:border-(--color-accent)/40 transition-colors duration-150"
                >
                  {g}
                </Link>
              ))}
            </div>
          )}

          {/* Artist & Author */}
          {manga.taxonomy &&
            (() => {
              const artists = manga.taxonomy.Artist?.map((a) => a.name) ?? [];
              const authors = manga.taxonomy.Author?.map((a) => a.name) ?? [];
              if (artists.length === 0 && authors.length === 0) return null;
              return (
                <div className="flex flex-col gap-1 mb-3 text-[12px]">
                  {authors.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-(--color-text-muted) shrink-0">
                        Author:
                      </span>
                      <span className="text-(--color-text-secondary)">
                        {authors.join(", ")}
                      </span>
                    </div>
                  )}
                  {artists.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-(--color-text-muted) shrink-0">
                        Artist:
                      </span>
                      <span className="text-(--color-text-secondary)">
                        {artists.join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

          {/* Description */}
          {manga.description && (
            <div>
              {(() => {
                const cleaned = cleanDescription(manga.description);
                return (
                  <>
                    <p
                      className={`text-[13px] leading-relaxed text-(--color-text-secondary) ${!descExpanded ? "line-clamp-4" : ""}`}
                    >
                      {cleaned}
                    </p>
                    {cleaned.length > 200 && (
                      <button
                        onClick={() => setDescExpanded((p) => !p)}
                        className="text-[12px] text-(--color-accent) hover:text-(--color-accent-hover) font-medium mt-1 transition-colors"
                      >
                        {descExpanded
                          ? "Tampilkan lebih sedikit"
                          : "Baca selengkapnya"}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </SectionErrorBoundary>
  );
}
