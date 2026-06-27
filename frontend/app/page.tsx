"use client";

import { useEffect, useState } from "react";
import { getLatest, SearchResult } from "@/lib/api";
import MangaCard from "@/components/MangaCard";

export default function HomePage() {
  const [items, setItems] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLatest("all").then(setItems).catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Latest Updates</h1>
      {error ? (
        <p className="text-[var(--muted)]">Error loading manga: {error}</p>
      ) : items.length === 0 ? (
        <p className="text-[var(--muted)]">Loading...</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map((item, i) => (
            <MangaCard
              key={`${item.source}-${item.id}-${i}`}
              title={item.title}
              cover={item.cover}
              source={item.source}
              id={item.id}
              chapter={item.chapter}
            />
          ))}
        </div>
      )}
    </div>
  );
}
