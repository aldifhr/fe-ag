"use client";
import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { searchManga, SearchResult } from "@/lib/api";
import MangaCard from "@/components/MangaCard";
import { addSearchHistory, getSearchHistory, clearSearchHistory } from "@/lib/searchHistory";

const STATUS_OPTIONS = [
  { label: "Semua", value: "" },
  { label: "Ongoing", value: "ongoing" },
  { label: "Completed", value: "completed" },
  { label: "Hiatus", value: "hiatus" },
] as const;

const SORT_OPTIONS = [
  { label: "Terbaru", value: "" },
  { label: "Populer", value: "popularity" },
  { label: "Rating", value: "rating" },
] as const;

function readLS(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) ?? fallback;
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto space-y-5"><div className="text-center py-20 text-[var(--color-text-muted)] text-sm">Loading...</div></div>}>
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [inputFocused, setInputFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const suggestDebRef = useRef<ReturnType<typeof setTimeout>>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [sortFilter, setSortFilter] = useState(() => readLS("manhwa-search-sort", ""));
  const [statusFilter, setStatusFilter] = useState(() => readLS("manhwa-search-status", ""));

  const { data: results = [], isLoading, error: queryError, refetch } = useQuery({
    queryKey: ["search", debouncedQuery, sortFilter, statusFilter],
    queryFn: () => searchManga(debouncedQuery, "shinigami", sortFilter || undefined, statusFilter || undefined),
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  const loading = isLoading;
  const error = queryError?.message ?? null;
  const hasSearched = debouncedQuery.trim().length >= 2;

  // Full search debounce (300ms)
  useEffect(() => {
    if (!query.trim()) {
      setDebouncedQuery("");
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Suggestions: fetch top 5 at 200ms debounce (faster than full search)
  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setShowSuggestions(false);
    if (suggestDebRef.current) clearTimeout(suggestDebRef.current);
    suggestDebRef.current = setTimeout(async () => {
      try {
        const res = await searchManga(query, "shinigami");
        setSuggestions(res.slice(0, 5));
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 200);
    return () => { if (suggestDebRef.current) clearTimeout(suggestDebRef.current); };
  }, [query]);

  // Hide suggestions when full results arrive
  useEffect(() => {
    if (hasSearched && results.length > 0) {
      setShowSuggestions(false);
    }
  }, [hasSearched, results]);

  // Record search history when debounced query changes
  useEffect(() => {
    if (hasSearched) {
      addSearchHistory(debouncedQuery);
      setSearchHistory(getSearchHistory());
    }
  }, [hasSearched, debouncedQuery]);

  // Load search history on mount
  useEffect(() => {
    setSearchHistory(getSearchHistory());
  }, []);

  // Persist filter choices
  useEffect(() => {
    localStorage.setItem("manhwa-search-sort", sortFilter);
  }, [sortFilter]);
  useEffect(() => {
    localStorage.setItem("manhwa-search-status", statusFilter);
  }, [statusFilter]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (suggestDebRef.current) clearTimeout(suggestDebRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setShowSuggestions(false);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setDebouncedQuery(query);
    }
  };

  const handleHistoryClick = (q: string) => {
    setQuery(q);
    setShowSuggestions(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setDebouncedQuery(q);
    inputRef.current?.focus();
  };

  const handleSuggestionClick = (item: SearchResult) => {
    setShowSuggestions(false);
    setQuery(item.title);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setDebouncedQuery(item.title);
    inputRef.current?.focus();
  };

  const showEmpty = !loading && !error && hasSearched && results.length === 0;
  const showPlaceholder = !hasSearched && !loading;
  const showHistory = inputFocused && !query && searchHistory.length > 0;
  const shouldShowSuggestions = showSuggestions && suggestions.length > 0 && query.trim().length >= 2 && !loading;

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
          onBlur={() => setTimeout(() => { setInputFocused(false); setShowSuggestions(false); }, 150)}
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
        {/* Autocomplete suggestions */}
        {shouldShowSuggestions && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {suggestions.map((item, i) => (
              <button
                key={`${item.source}-${item.id}-${i}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSuggestionClick(item)}
                className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-[var(--color-surface-hover)] cursor-pointer text-left"
              >
                {item.cover ? (
                  <img
                    src={item.cover}
                    alt={item.title}
                    className="w-6 h-8 rounded object-cover shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-6 h-8 rounded bg-[var(--color-border)] shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-[var(--color-text)] truncate">{item.title}</p>
                  {item.chapter && (
                    <span className="text-[11px] text-[var(--color-text-muted)]">Ch. {item.chapter}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      {hasSearched && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={`sort-${opt.value}`}
                onClick={() => setSortFilter(opt.value)}
                className={`px-3 py-1 text-[13px] rounded-full transition-colors duration-150 ${
                  sortFilter === opt.value
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
            <span className="w-px h-5 self-center bg-[var(--color-border)]" />
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={`status-${opt.value}`}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1 text-[13px] rounded-full transition-colors duration-150 ${
                  statusFilter === opt.value
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

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
          {results.length} hasil untuk &lsquo;{debouncedQuery}&rsquo;
        </p>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex flex-col">
              <div className="skeleton aspect-[3/4] w-full rounded-lg" />
              <div className="mt-2 space-y-1.5 px-0.5">
                <div className="skeleton h-3.5 w-3/4 rounded" />
                <div className="skeleton h-3 w-1/2 rounded" />
              </div>
            </div>
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
            onClick={() => refetch()}
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
              status={item.status}
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
            Tidak ditemukan hasil untuk &lsquo;{debouncedQuery}&rsquo;
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
