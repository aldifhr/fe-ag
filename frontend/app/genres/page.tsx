"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getGenres, Genre } from "@/lib/api";
// TODO: shared DRY modules (created by parallel agent)
import ErrorState from "@/components/ErrorState";
import EmptyState from "@/components/EmptyState";
import Spinner from "@/components/Spinner";
import ErrorIcon from "@/components/ErrorIcon";

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
        <ErrorState message={`Gagal memuat: ${error}`} onRetry={() => setRetryKey((k) => k + 1)} />
      ) : loading ? (
        <SkeletonChips />
      ) : genres.length === 0 ? (
        <EmptyState title="Tidak ada genre tersedia" />
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
