"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getGenres, Genre } from "@/lib/api";

function SkeletonChips() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} className="h-12 skeleton rounded-lg" />
      ))}
    </div>
  );
}

export default function GenresPage() {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Genre</h1>
        <p className="text-[13px] text-(--color-text-muted) mt-0.5">
          Jelajahi berdasarkan genre
        </p>
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <div className="w-12 h-12 rounded-full bg-(--color-surface) border border-(--color-border) flex items-center justify-center">
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
          <p className="text-sm text-(--color-text-secondary)">
            Gagal memuat: {error}
          </p>
          <button
            onClick={() => setRetryKey((k) => k + 1)}
            className="px-4 py-2 text-[13px] font-medium rounded-lg bg-(--color-surface) border border-(--color-border) text-(--color-text-secondary) hover:text-(--color-text) hover:border-(--color-border-hover) transition-colors duration-150"
          >
            Coba Lagi
          </button>
        </div>
      ) : loading ? (
        <SkeletonChips />
      ) : genres.length === 0 ? (
        <div className="py-20 text-center text-(--color-text-muted) text-sm">
          Tidak ada genre tersedia
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {genres.map((g) => (
            <Link
              key={g.taxonomy_id}
              href={`/genres/${g.slug}`}
              className="rounded-lg bg-(--color-surface) border border-(--color-border) px-4 py-3 text-[13px] font-medium text-(--color-text-secondary) hover:border-(--color-accent) hover:text-(--color-accent) transition-colors"
            >
              {g.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
