"use client";
import { useState, useCallback } from "react";
import { searchManga, SearchResult } from "@/lib/api";
import MangaCard from "@/components/MangaCard";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await searchManga(query);
      setResults(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Search Manga</h1>
      <div className="flex gap-2 mb-8">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Cari judul manhwa..."
          className="flex-1 px-4 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-6 py-2 bg-[var(--accent)] rounded-lg font-medium text-sm hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {loading ? "..." : "Search"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {results.map((item, i) => (
            <MangaCard
              key={`${item.source}-${item.id}-${i}`}
              title={item.title}
              cover={item.cover}
              source={item.source}
              id={item.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
