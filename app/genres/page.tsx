"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getGenres, Genre } from "@/lib/api";
import ErrorState from "@/components/ErrorState";
import EmptyState from "@/components/EmptyState";

/* ─── Skeleton ─── */

function SkeletonCards() {
  return (
    <div className="space-y-8 animate-pulse">
      {[1, 2, 3].map((section) => (
        <div key={section}>
          <div className="h-5 w-32 skeleton rounded-md mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-[68px] skeleton rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Icons ─── */

function IconSearch() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-(--color-text-muted)"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

/* ─── Type → label + accent colour ─── */

const TYPE_CONFIG: Record<string, { label: string; accent: string }> = {
  genre: { label: "Genre", accent: "border-l-[#60a5fa]" },
  genres: { label: "Genre", accent: "border-l-[#60a5fa]" },
  demographic: { label: "Demografi", accent: "border-l-[#a78bfa]" },
  theme: { label: "Tema", accent: "border-l-[#fbbf24]" },
};

function typeLabel(t: string): string {
  return TYPE_CONFIG[t]?.label ?? t.charAt(0).toUpperCase() + t.slice(1);
}

function typeAccent(t: string): string {
  return TYPE_CONFIG[t]?.accent ?? "border-l-(--color-accent)";
}

/* ─── Genre Card ─── */

function GenreCard({ genre, accent }: { genre: Genre; accent: string }) {
  return (
    <Link
      key={genre.taxonomy_id}
      href={`/genres/${genre.slug}`}
      className={`group flex flex-col justify-between gap-1 rounded-xl bg-(--color-surface) border border-(--color-border) border-l-[3px] ${accent} p-3.5 transition-all hover:border-(--color-border-hover) hover:bg-(--color-surface-hover)`}
    >
      <span className="text-sm font-semibold text-(--color-text) leading-snug">
        {genre.name}
      </span>
      <span className="inline-flex items-center gap-1 text-[11px] text-(--color-text-muted) group-hover:text-(--color-accent) transition-colors">
        Lihat
        <IconArrowRight />
      </span>
    </Link>
  );
}

/* ─── Main Page ─── */

export default function GenresPage() {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getGenres()
      .then((res) => {
        if (!cancelled) setGenres(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [retryKey]);

  /* ── Filtered + grouped genres ── */

  const filtered = useMemo(() => {
    if (!search.trim()) return genres;
    const q = search.toLowerCase();
    return genres.filter((g) => g.name.toLowerCase().includes(q));
  }, [genres, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Genre[]>();
    for (const g of filtered) {
      const key = g.type || "other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    }
    // Sort sections by a defined order, then alphabetically
    const order = ["genre", "genres", "demographic", "theme"];
    return [...map.entries()].sort(([a], [b]) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  const showSearch = !loading && !error;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Genre</h1>
        <p className="text-[13px] text-(--color-text-muted) mt-0.5">
          Jelajahi berdasarkan genre
        </p>
      </div>

      {/* ── Search ── */}
      {showSearch && (
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <IconSearch />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari genre..."
            className="w-full rounded-xl bg-(--color-surface) border border-(--color-border) pl-10 pr-4 py-2.5 text-sm text-(--color-text) placeholder:text-(--color-text-muted) outline-none transition-colors focus:border-(--color-accent)"
          />
        </div>
      )}

      {/* ── Error ── */}
      {error ? (
        <ErrorState
          message={`Gagal memuat: ${error}`}
          onRetry={() => setRetryKey((k) => k + 1)}
        />
      ) : loading ? (
        <SkeletonCards />
      ) : grouped.length === 0 ? (
        search.trim() ? (
          <div className="pt-4">
            <EmptyState
              icon={
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              }
              title={`Tidak ada genre untuk "${search}"`}
              subtitle="Coba kata kunci lain"
            />
          </div>
        ) : (
          <EmptyState title="Tidak ada genre tersedia" />
        )
      ) : (
        /* ── Grouped genre cards ── */
        <div className="space-y-8">
          {grouped.map(([type, items]) => (
            <section key={type}>
              <h2 className="text-sm font-bold text-(--color-text) mb-3 flex items-center gap-2">
                <span
                  className={`inline-block w-1 h-4 rounded-full ${
                    typeAccent(type).replace("border-l-", "bg-")
                  }`}
                />
                {typeLabel(type)}
                <span className="text-[11px] font-normal text-(--color-text-muted)">
                  ({items.length})
                </span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {items.map((g) => (
                  <GenreCard key={g.taxonomy_id} genre={g} accent={typeAccent(g.type)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
