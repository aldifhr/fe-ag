"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

/* ── Types ── */

interface MangaData {
  title: string;
  titleKey: string;
  cover: string | null;
  sources: { source: string; url: string }[];
  metadata: {
    status?: string;
    rating?: string;
    genres?: string[];
    description?: string;
  };
  latestChapter?: {
    number: number;
    url: string;
    sentAt: string;
    source: string;
  } | null;
}

interface ChapterItem {
  number: number;
  url: string;
  sentAt: string;
  source: string;
  title?: string;
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins}m lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}j lalu`;
  const days = Math.floor(hrs / 24);
  return `${days}h lalu`;
}

export default function MangaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [data, setData] = useState<MangaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(true);

  const fetchManga = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reader/whitelist/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Failed to load manga");
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchChapters = useCallback(async () => {
    if (!id) return;
    setChaptersLoading(true);
    try {
      const res = await fetch(`/api/reader/catalog/${id}/chapters`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setChapters(json.data ?? []);
    } catch {
      setChapters([]);
    } finally {
      setChaptersLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchManga(); }, [fetchManga]);
  useEffect(() => { fetchChapters(); }, [fetchChapters]);

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="flex flex-col md:flex-row gap-6">
        <div className="skeleton w-48 md:w-72 aspect-[3/4] shrink-0 rounded-xl" />
        <div className="flex-1 space-y-4">
          <div className="skeleton h-8 w-3/4 rounded" />
          <div className="skeleton h-4 w-1/3 rounded" />
          <div className="skeleton h-4 w-1/4 rounded" />
          <div className="skeleton h-24 w-full rounded" />
          <div className="flex gap-2">
            <div className="skeleton h-6 w-16 rounded-full" />
            <div className="skeleton h-6 w-16 rounded-full" />
            <div className="skeleton h-6 w-16 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <p className="text-(--color-text) text-lg font-medium">Gagal memuat manga</p>
        <p className="text-(--color-text-muted) text-sm max-w-md">{error}</p>
        <button
          onClick={fetchManga}
          className="mt-2 px-5 py-2 rounded-lg bg-(--color-accent) text-white text-sm font-medium transition-colors cursor-pointer"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  // ── Empty / not found ──
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <p className="text-(--color-text-muted) text-lg">Manga tidak ditemukan</p>
        <button
          onClick={() => router.push("/")}
          className="px-5 py-2 rounded-lg bg-(--color-accent) text-white text-sm font-medium transition-colors cursor-pointer"
        >
          Kembali
        </button>
      </div>
    );
  }

  const latestCh = data.latestChapter;

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        {/* Cover */}
        <div className="shrink-0 flex justify-center md:block">
          {data.cover ? (
            <img
              src={data.cover}
              alt={data.title}
              className="w-48 md:w-72 aspect-[3/4] rounded-xl object-cover bg-(--color-surface) border border-(--color-border) shadow-lg"
            />
          ) : (
            <div className="w-48 md:w-72 aspect-[3/4] rounded-xl bg-(--color-surface) border border-(--color-border) flex items-center justify-center text-(--color-text-muted) text-sm">
              No Cover
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-4">
          <h1 className="text-2xl md:text-3xl font-bold text-(--color-text) leading-tight">
            {data.title}
          </h1>

          {/* Status + Rating */}
          <div className="flex flex-wrap items-center gap-3">
            {data.metadata?.status && (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  data.metadata.status === "Ongoing"
                    ? "bg-green-500/15 text-green-400 border-green-500/30"
                    : data.metadata.status === "Completed"
                      ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                      : "bg-(--color-surface) text-(--color-text-muted) border-(--color-border)"
                }`}
              >
                {data.metadata.status}
              </span>
            )}
            {data.metadata?.rating && (
              <span className="inline-flex items-center gap-1 text-sm text-(--color-text)">
                <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {data.metadata.rating}
              </span>
            )}
          </div>

          {/* Genres */}
          {data.metadata?.genres && data.metadata.genres.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.metadata.genres.map((genre) => (
                <span
                  key={genre}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-(--color-accent-dim) text-(--color-accent) border border-(--color-accent)/20"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {data.metadata?.description && (
            <p className="text-(--color-text-secondary) text-sm leading-relaxed whitespace-pre-line">
              {data.metadata.description}
            </p>
          )}

          {/* Sources */}
          {data.sources && data.sources.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.sources.map((s) => (
                <a
                  key={s.source}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-(--color-surface) border border-(--color-border) text-(--color-text-muted) hover:text-(--color-text) hover:border-(--color-accent)/30 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  {s.source}
                </a>
              ))}
            </div>
          )}

          {/* Latest Chapter */}
          {latestCh && (
            <div className="p-4 rounded-xl bg-(--color-surface) border border-(--color-border) space-y-2">
              <p className="text-xs text-(--color-text-muted) uppercase tracking-wider font-medium">
                Chapter Terbaru
              </p>
              <div className="flex items-center justify-between gap-2">
                <a
                  href={latestCh.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-(--color-accent) hover:text-(--color-accent-hover) font-medium transition-colors text-sm"
                >
                  Chapter {latestCh.number}
                </a>
                <span className="text-xs text-(--color-text-muted) shrink-0 capitalize">
                  {latestCh.source}
                </span>
              </div>
              {latestCh.sentAt && (
                <p className="text-xs text-(--color-text-muted)">
                  {new Date(latestCh.sentAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Chapter History ── */}
      <section className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 space-y-3">
        <h2 className="text-sm font-semibold text-(--color-text)">Riwayat Chapter</h2>

        {chaptersLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : chapters.length === 0 ? (
          <p className="text-sm text-(--color-text-muted) py-4 text-center">
            Belum ada riwayat pengiriman
          </p>
        ) : (
          <div className="space-y-1">
            {chapters.map((ch, i) => (
              <div
                key={`${ch.number}-${ch.source}-${i}`}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-(--color-surface-hover) transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-semibold text-(--color-text-muted) tabular-nums shrink-0 w-12 text-right">
                    #{ch.number}
                  </span>
                  {ch.title && (
                    <span className="text-sm text-(--color-text) truncate">{ch.title}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  {ch.source && (
                    <span className="text-[11px] font-medium capitalize px-2 py-0.5 rounded-full bg-(--color-surface-hover) text-(--color-text-muted)">
                      {ch.source}
                    </span>
                  )}
                  {ch.sentAt && (
                    <span className="text-xs text-(--color-text-muted) tabular-nums">
                      {timeAgo(ch.sentAt)}
                    </span>
                  )}
                  {ch.url && (
                    <a
                      href={ch.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-(--color-text-muted) hover:text-(--color-accent) transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
