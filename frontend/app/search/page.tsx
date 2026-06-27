"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { searchManga, SearchResult } from "@/lib/api";
import MangaCard from "@/components/MangaCard";
import { addSearchHistory, getSearchHistory, clearSearchHistory } from "@/lib/searchHistory";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [inputFocused, setInputFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setHasSearched(false);
      setError(null);
      return;
    }
    addSearchHistory(q);
    setSearchHistory(getSearchHistory());
    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const res = await searchManga(q, "shinigami");
      setResults(res);
    } catch {
      setError("Gagal mengambil data. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  // Load search history on mount
  useEffect(() => {
    setSearchHistory(getSearchHistory());
  }, []);

  // Auto-search from URL params
  useEffect(() => {
    if (initialQuery) doSearch(initialQuery);
  }, [initialQuery, doSearch]);

  const handleEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      doSearch(query);
    }
  };

  const handleHistoryClick = (q: string) => {
    setQuery(q);
    inputRef.current?.focus();
  };

  const showEmpty = !loading && !error && hasSearched && results.length === 0;
  const showPlaceholder = !hasSearched && !loading;
  const showHistory = inputFocused && !query && searchHistory.length > 0;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Search header */}
      <h1 className="text-xl font-semibold tracking-tight">
        Cari Manhwa
      </h1>

      {/* Search input */}
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[var(--color-text-muted)] pointer-events-none"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleEnter}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setTimeout(() => setInputFocused(false), 150)}
          placeholder="Cari judul manhwa..."
          autoFocus
          className="w-full pl-12 pr-10 py-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-[15px] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] transition-colors duration-150"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors duration-150"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"/>
              <path d="m6 6 12 12"/>
            </svg>
          </button>
        )}
      </div>

      {/* Search history */}
      {showHistory && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[var(--color-text-muted)]">Pencarian terakhir</span>
            <button
              onClick={() => { clearSearchHistory(); setSearchHistory([]); }}
              className="text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors"
            >
              Hapus riwayat
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {searchHistory.map((q, i) => (
              <button
                key={`${q}-${i}`}
                onClick={() => handleHistoryClick(q)}
                className="px-3 py-1 text-[13px] rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text)] transition-colors duration-150"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results count */}
      {hasSearched && !loading && !error && (
        <p className="text-[13px] text-[var(--color-text-muted)]">
          {results.length} hasil untuk &lsquo;{query}&rsquo;
        </p>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton rounded-lg aspect-[3/4]" />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="text-center py-20">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4"/>
              <path d="M12 16h.01"/>
            </svg>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] mb-3">{error}</p>
          <button
            onClick={() => doSearch(query)}
            className="px-4 py-2 text-[13px] font-medium rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] transition-colors duration-150"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Results */}
      {!loading && !error && results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {results.map((item, i) => (
            <MangaCard
              key={`${item.source}-${item.id}-${i}`}
              title={item.title}
              cover={item.cover}
              source={item.source}
              id={item.id}
              time={item.time}
            />
          ))}
        </div>
      )}

      {/* Empty — no results */}
      {showEmpty && (
        <div className="text-center py-20">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
              <path d="M8 11h6"/>
            </svg>
          </div>
          <p className="text-[var(--color-text-secondary)]">
            Tidak ditemukan hasil untuk &lsquo;{query}&rsquo;
          </p>
        </div>
      )}

      {/* Placeholder — no query yet */}
      {showPlaceholder && (
        <div className="text-center py-20">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <p className="text-[var(--color-text-secondary)]">Ketik judul manhwa untuk mulai mencari</p>
        </div>
      )}
    </div>
  );
}
