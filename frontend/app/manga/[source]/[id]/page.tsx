"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getMangaDetail, MangaDetail, getLatest } from "@/lib/api";
import { isFavorite, addFavorite, removeFavorite } from "@/lib/favorites";
import { getReadChapters, getLastReadChapter, markAsRead, unmarkAsRead } from "@/lib/history";
import { showToast } from "@/lib/toast";
import Link from "next/link";
import MangaCard from "@/components/MangaCard";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function Skeleton() {
  return (
    <div className="flex flex-col md:flex-row gap-6 md:gap-8 mb-10">
      <div className="w-36 md:w-48 shrink-0 mx-auto md:mx-0">
        <div className="skeleton w-full aspect-[3/4] rounded-lg" />
      </div>
      <div className="flex-1 min-w-0 pt-2">
        <div className="skeleton h-8 w-3/4 mb-3 rounded" />
        <div className="skeleton h-4 w-24 mb-4 rounded" />
        <div className="flex gap-2 mb-4">
          <div className="skeleton h-5 w-14 rounded" />
          <div className="skeleton h-5 w-16 rounded" />
          <div className="skeleton h-5 w-12 rounded" />
        </div>
        <div className="skeleton h-4 w-full mb-1.5 rounded" />
        <div className="skeleton h-4 w-5/6 mb-1.5 rounded" />
        <div className="skeleton h-4 w-2/3 rounded" />
      </div>
    </div>
  );
}

export default function MangaDetailPage() {
  const params = useParams<{ source: string; id: string }>();
  const source = params.source;
  const id = params.id;

  const [descExpanded, setDescExpanded] = useState(false);
  const [fav, setFav] = useState(false);
  const [readChapters, setReadChapters] = useState<Set<string>>(new Set());
  const [chapterPage, setChapterPage] = useState(1);
  const [lastRead, setLastRead] = useState<number | null>(null);
  const [chapterJump, setChapterJump] = useState("");
  const [jumpError, setJumpError] = useState<string | null>(null);
  const [chapterSort, setChapterSort] = useState<"desc" | "asc">("desc");
  const CHAPTERS_PER_PAGE = 10;

  const mangaId = useMemo(() => {
    return id.includes("://") ? (id.match(/\/(\d+)\/?$/) || id.match(/(\d+)/))?.[1] ?? id : id;
  }, [id]);

  const { data, isLoading, error: queryError } = useQuery<MangaDetail>({
    queryKey: ["manga", id],
    queryFn: () => getMangaDetail(mangaId, "shinigami"),
    staleTime: 5 * 60 * 1000,
  });

  const errorMsg = queryError ? (queryError instanceof Error ? queryError.message : String(queryError)) : null;

  useEffect(() => {
    setFav(isFavorite(id));
    setReadChapters(getReadChapters(id));
    setLastRead(getLastReadChapter(id));
  }, [id]);

  // Sort chapters
  const chapters = data?.chapters ?? [];
  const sortedChapters = useMemo(() => {
    const sorted = [...chapters];
    sorted.sort((a, b) => {
      const numA = Number(a.number);
      const numB = Number(b.number);
      return chapterSort === "desc" ? numB - numA : numA - numB;
    });
    return sorted;
  }, [chapters, chapterSort]);

  // Recommendations
  const { data: recommendations = [] } = useQuery<{ id: string; title: string; cover: string | null; source: string }[]>({
    queryKey: ["recommendations", data?.manga.id],
    queryFn: async () => {
      const latest = await getLatest("shinigami", 1);
      const filtered = latest.filter((m) => m.id !== data!.manga.id);
      // Fisher-Yates shuffle
      for (let i = filtered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
      }
      return filtered.slice(0, 6);
    },
    enabled: !!data?.manga.id,
    staleTime: 10 * 60 * 1000,
  });

  if (errorMsg) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-lg font-semibold mb-2">Manga tidak ditemukan</h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">{errorMsg}</p>
        <Link href="/" className="text-[13px] text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors">
          &larr; Kembali ke beranda
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-[60vh]">
        <Skeleton />
      </div>
    );
  }

  const { manga } = data;
  const uniqueGenres = [...new Set(manga.genres ?? [])];
  const isOngoing = String(manga.status ?? "").toLowerCase() === "ongoing";

  return (
    <div>
      {/* Hero section */}
      <div className="flex flex-col md:flex-row gap-6 md:gap-8 mb-10">
        {/* Cover */}
        <div className="w-36 md:w-48 shrink-0 mx-auto md:mx-0">
          {manga.cover ? (
            <img
              src={manga.cover}
              alt={manga.title}
              className="w-full rounded-lg shadow-lg shadow-black/30"
            />
          ) : (
            <div className="w-full aspect-[3/4] bg-[var(--color-surface)] rounded-lg flex items-center justify-center text-[var(--color-text-muted)] text-sm border border-[var(--color-border)]">
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
            <span className="shrink-0 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
              {manga.source}
            </span>
          </div>

          {/* Alternative title */}
          {manga.alternative_title && (
            <p className="text-[12px] text-[var(--color-text-muted)] mb-2 italic">
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
                addFavorite({ id, title: manga.title, cover: manga.cover, source: manga.source });
                setFav(true);
                showToast("Ditambahkan ke bookmark");
              }
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors duration-150 mb-3 ${
              fav
                ? "bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/20"
                : "bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill={fav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            {fav ? "Tersimpan" : "Bookmark"}
          </button>

          {/* Share */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              showToast("Link disalin!");
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors duration-150 mb-3 bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-secondary)] cursor-pointer"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A3 3 0 1 0 18 2a3 3 0 0 0 0 6z"/>
              <path d="M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
              <path d="M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Bagikan
          </button>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-3 text-[12px]">
            {manga.user_rate && (
              <div className="flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-400">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <span className="text-[var(--color-text)] font-medium">{Number(manga.user_rate).toFixed(1)}</span>
              </div>
            )}
            {manga.view_count != null && (
              <div className="flex items-center gap-1 text-[var(--color-text-muted)]">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <span>{formatNumber(manga.view_count)} views</span>
              </div>
            )}
            {manga.bookmark_count != null && (
              <div className="flex items-center gap-1 text-[var(--color-text-muted)]">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                <span>{formatNumber(manga.bookmark_count)}</span>
              </div>
            )}
            {manga.release_year && (
              <span className="text-[var(--color-text-muted)]">{manga.release_year}</span>
            )}
            {manga.country_id && (
              <span className="text-[var(--color-text-muted)]">{manga.country_id}</span>
            )}
          </div>

          {/* Status */}
          {manga.status && (
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2 h-2 rounded-full ${isOngoing ? "bg-[var(--color-success)]" : "bg-[var(--color-text-muted)]"}`} />
              <span className="text-[13px] text-[var(--color-text-secondary)] capitalize">{manga.status}</span>
            </div>
          )}

          {/* Genres */}
          {uniqueGenres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {uniqueGenres.map((g, i) => (
                <span
                  key={`${g}-${i}`}
                  className="px-2 py-0.5 text-[11px] font-medium rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)]"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Artist & Author */}
          {manga.taxonomy && (() => {
            const artists = manga.taxonomy.Artist?.map(a => a.name) ?? [];
            const authors = manga.taxonomy.Author?.map(a => a.name) ?? [];
            if (artists.length === 0 && authors.length === 0) return null;
            return (
              <div className="flex flex-col gap-1 mb-3 text-[12px]">
                {authors.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[var(--color-text-muted)] shrink-0">Author:</span>
                    <span className="text-[var(--color-text-secondary)]">{authors.join(", ")}</span>
                  </div>
                )}
                {artists.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[var(--color-text-muted)] shrink-0">Artist:</span>
                    <span className="text-[var(--color-text-secondary)]">{artists.join(", ")}</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Description */}
          {manga.description && (
            <div>
              <p className={`text-[13px] leading-relaxed text-[var(--color-text-secondary)] ${!descExpanded ? "line-clamp-4" : ""}`}>
                {manga.description}
              </p>
              {manga.description.length > 200 && (
                <button
                  onClick={() => setDescExpanded((p) => !p)}
                  className="text-[12px] text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] font-medium mt-1 transition-colors"
                >
                  {descExpanded ? "Tampilkan lebih sedikit" : "Baca selengkapnya"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chapter list */}
      <div>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          Chapter <span className="text-[var(--color-text-muted)] font-normal">({sortedChapters.length})</span>
          <span className="text-[var(--color-text-muted)]">·</span>
          <button
            onClick={() => {
              setChapterSort((p) => (p === "desc" ? "asc" : "desc"));
              setChapterPage(1);
            }}
            className="text-[12px] text-[var(--color-accent)] font-medium hover:text-[var(--color-accent-hover)] cursor-pointer"
          >
            {chapterSort === "desc" ? "↑ Terlama" : "↓ Terbaru"}
          </button>
        </h2>

        {/* Lanjut dari Chapter X banner */}
        {lastRead !== null && sortedChapters.length > 0 && (() => {
          const matchCh = sortedChapters.find((ch) => ch.number === lastRead);
          if (!matchCh) return null;
          return (
            <Link
              href={`/manga/${source}/${encodeURIComponent(id)}/${lastRead}`}
              onClick={() => {
                try {
                  localStorage.setItem(`manhwa-meta-${source}-${id}-${lastRead}`, JSON.stringify({ baseUrl: manga.url || "", chapterId: String(matchCh.id || "") }));
                } catch {}
              }}
              className="flex items-center gap-3 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 rounded-lg px-4 py-3 mb-4 group transition-colors hover:bg-[var(--color-accent)]/15"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polygon points="10 8 16 12 10 16 10 8" fill="var(--color-accent)" stroke="var(--color-accent)"/>
              </svg>
              <span className="flex-1 text-[13px] font-semibold text-[var(--color-accent)]">
                Lanjutkan dari Chapter {lastRead}
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </Link>
          );
        })()}

        {sortedChapters.length === 0 ? (
          <p className="text-[var(--color-text-muted)] py-10 text-center text-[13px]">Belum ada chapter tersedia.</p>
        ) : (
          <>
            {/* Chapter jump input */}
            <div className="flex items-center gap-2 mb-3">
              <input
                type="number"
                placeholder="Loncat ke chapter..."
                value={chapterJump}
                onChange={(e) => { setChapterJump(e.target.value); setJumpError(null); }}
                onFocus={() => setJumpError(null)}
                className="w-24 px-2.5 py-1.5 text-[12px] rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:border-[var(--color-accent)] outline-none transition-colors"
              />
              <button
                onClick={() => {
                  const num = parseFloat(chapterJump);
                  if (isNaN(num)) { setJumpError("Masukkan nomor chapter"); return; }
                  const idx = sortedChapters.findIndex((ch) => ch.number === num);
                  if (idx === -1) { setJumpError("Chapter tidak ditemukan"); return; }
                  const targetPage = Math.floor(idx / CHAPTERS_PER_PAGE) + 1;
                  setChapterPage(targetPage);
                  requestAnimationFrame(() => {
                    document.getElementById(`chapter-${num}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                  });
                }}
                className="text-[12px] text-[var(--color-accent)] font-medium hover:text-[var(--color-accent-hover)] cursor-pointer"
              >
                Loncat
              </button>
              {jumpError && <span className="text-[11px] text-[var(--color-danger)]">{jumpError}</span>}
            </div>

            <div className="flex flex-col">
              {sortedChapters.slice((chapterPage - 1) * CHAPTERS_PER_PAGE, chapterPage * CHAPTERS_PER_PAGE).map((ch) => (
                <Link
                  key={`${ch.id}`}
                  id={`chapter-${ch.number}`}
                  href={`/manga/${source}/${encodeURIComponent(id)}/${ch.number}`}
                  onClick={() => {
                    try {
                      localStorage.setItem(`manhwa-meta-${source}-${id}-${ch.number}`, JSON.stringify({ baseUrl: manga.url || "", chapterId: String(ch.id || "") }));
                    } catch {}
                  }}
                  className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] hover:bg-[var(--color-surface)] transition-colors duration-150 group"
                >
                  <div className="min-w-0 flex items-center gap-1.5">
                    {/* Mark as read checkbox */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.nativeEvent.stopImmediatePropagation();
                        if (readChapters.has(String(ch.number))) {
                          unmarkAsRead(id, Number(ch.number));
                        } else {
                          markAsRead(id, manga.title, manga.cover, manga.source, Number(ch.number));
                        }
                        setReadChapters(getReadChapters(id));
                      }}
                      className="p-1 rounded hover:bg-[var(--color-surface)] transition-colors shrink-0"
                      aria-label={readChapters.has(String(ch.number)) ? "Tandai belum dibaca" : "Tandai sudah dibaca"}
                    >
                      {readChapters.has(String(ch.number)) ? (
                        <svg className="w-4 h-4 text-[var(--color-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                        </svg>
                      )}
                    </button>
                    {readChapters.has(String(ch.number)) && (
                      <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    )}
                    <span className={`text-[13px] font-medium transition-colors ${readChapters.has(String(ch.number)) ? "text-[var(--color-text-muted)] opacity-60 group-hover:text-[var(--color-text-secondary)]" : "text-[var(--color-text)] group-hover:text-white"}`}>
                      Chapter {ch.number}
                    </span>
                    {ch.title && (
                      <span className="text-[13px] text-[var(--color-text-muted)] ml-2">
                        {ch.title}
                      </span>
                    )}
                  </div>
                  {ch.createdAt && (
                    <span className="text-[12px] text-[var(--color-text-muted)] shrink-0 ml-4 tabular-nums">
                      {new Date(ch.createdAt).toLocaleDateString("id-ID")}
                    </span>
                  )}
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {Math.ceil(sortedChapters.length / CHAPTERS_PER_PAGE) > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4 pt-4">
                <button
                  onClick={() => setChapterPage((p) => Math.max(1, p - 1))}
                  disabled={chapterPage === 1}
                  className="px-3 py-1.5 text-[12px] font-medium rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  &laquo; Prev
                </button>
                <span className="text-[12px] text-[var(--color-text-muted)] tabular-nums">
                  {chapterPage} / {Math.ceil(sortedChapters.length / CHAPTERS_PER_PAGE)}
                </span>
                <button
                  onClick={() => setChapterPage((p) => Math.min(Math.ceil(sortedChapters.length / CHAPTERS_PER_PAGE), p + 1))}
                  disabled={chapterPage === Math.ceil(sortedChapters.length / CHAPTERS_PER_PAGE)}
                  className="px-3 py-1.5 text-[12px] font-medium rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next &raquo;
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Manga Lainnya */}
      {recommendations.length > 0 && (
        <div className="mt-10">
          <h2 className="text-base font-semibold mb-4">Manga Lainnya</h2>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {recommendations.map((m) => (
              <MangaCard key={m.id} id={m.id} title={m.title} cover={m.cover} source={m.source} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
