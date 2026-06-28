"use client";
import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { searchManga, SearchResult } from "@/lib/api";
import {
  addSearchHistory,
  getSearchHistory,
} from "@/lib/searchHistory";
import SearchInput from "./SearchInput";
import SearchFilters from "./SearchFilters";
import SearchHistory from "./SearchHistory";
import SearchResults from "./SearchResults";

function readLS(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) ?? fallback;
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-5xl mx-auto space-y-5">
          <div className="text-center py-20 text-(--color-text-muted) text-sm">
            Loading...
          </div>
        </div>
      }
    >
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
  const [sortFilter, setSortFilter] = useState(() =>
    readLS("manhwa-search-sort", ""),
  );
  const [statusFilter, setStatusFilter] = useState(() =>
    readLS("manhwa-search-status", ""),
  );

  const {
    data: rawResults = [],
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ["search", debouncedQuery, sortFilter, statusFilter],
    queryFn: () =>
      searchManga(
        debouncedQuery,
        "shinigami",
        sortFilter === "az" ? undefined : sortFilter || undefined,
        statusFilter || undefined,
      ),
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  const results =
    sortFilter === "az"
      ? [...rawResults].sort((a, b) => a.title.localeCompare(b.title, "id"))
      : rawResults;

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
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
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
    return () => {
      if (suggestDebRef.current) clearTimeout(suggestDebRef.current);
    };
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
  const shouldShowSuggestions =
    showSuggestions &&
    suggestions.length > 0 &&
    query.trim().length >= 2 &&
    !loading;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <SearchInput
        query={query}
        setQuery={setQuery}
        handleEnter={handleEnter}
        inputRef={inputRef}
        setInputFocused={setInputFocused}
        setShowSuggestions={setShowSuggestions}
        shouldShowSuggestions={shouldShowSuggestions}
        suggestions={suggestions}
        handleSuggestionClick={handleSuggestionClick}
        loading={loading}
      />

      <SearchFilters
        sortFilter={sortFilter}
        setSortFilter={setSortFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        hasSearched={hasSearched}
      />

      <SearchHistory
        showHistory={showHistory}
        searchHistory={searchHistory}
        setSearchHistory={setSearchHistory}
        handleHistoryClick={handleHistoryClick}
      />

      <SearchResults
        loading={loading}
        error={error}
        results={results}
        hasSearched={hasSearched}
        showEmpty={showEmpty}
        showPlaceholder={showPlaceholder}
        debouncedQuery={debouncedQuery}
        refetch={refetch}
      />
    </div>
  );
}
