"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { searchManga, SearchResult, proxyCover } from "@/lib/api";
import Link from "next/link";
import EmptyState from "./EmptyState";
import { useDebounce } from "@/lib/hooks/useDebounce";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SearchModal({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debouncedQuery = useDebounce(query, 300);
  const lastSearchedRef = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();
  const MAX_RESULTS = 8;

  // Focus input on open
  useEffect(() => {
    if (open) {
      // Small delay so transition starts first
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setHasSearched(false);
      setError(null);
      setSelectedIndex(-1);
      return;
    }
    // Abort previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const res = await searchManga(q, "shinigami", undefined, undefined, controller.signal);
      setResults(res);
      setSelectedIndex(res.length > 0 ? 0 : -1);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError("Gagal mengambil data. Coba lagi.");
      setSelectedIndex(-1);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      setLoading(false);
      setError(null);
      setSelectedIndex(-1);
      return;
    }
    if (debouncedQuery === lastSearchedRef.current) return;
    setSelectedIndex(-1);
    doSearch(debouncedQuery);
  }, [debouncedQuery, doSearch]);

  const visibleResults = results.slice(0, MAX_RESULTS);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const next = prev < visibleResults.length - 1 ? prev + 1 : 0;
        document.getElementById(`search-result-${next}`)?.scrollIntoView({ block: "nearest" });
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : visibleResults.length - 1;
        document.getElementById(`search-result-${next}`)?.scrollIntoView({ block: "nearest" });
        return next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && visibleResults.length > 0) {
        const item = visibleResults[selectedIndex];
        router.push(`/manga/${item.source}/${encodeURIComponent(item.id)}`);
        handleClose();
      } else {
        lastSearchedRef.current = query;
        doSearch(query);
      }
    }
  };

  // Reset on close
  const handleClose = () => {
    abortRef.current?.abort();
    setQuery("");
    setResults([]);
    setHasSearched(false);
    setError(null);
    setSelectedIndex(-1);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
      className="fixed inset-0 z-100 flex flex-col overflow-hidden"
      style={{
        backgroundColor: "rgba(10, 10, 15, 0.8)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-(--color-surface-hover) transition-colors duration-150"
        aria-label="Tutup"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18"/>
          <path d="m6 6 12 12"/>
        </svg>
      </button>

      {/* Centered search block */}
      <div className="flex-1 flex flex-col justify-start pt-[35vh] sm:pt-[30vh] px-4 sm:px-6">
        <div className="relative max-w-2xl mx-auto w-full">
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
            onKeyDown={handleKeyDown}
            placeholder="Cari judul manhwa..."
            className="w-full pl-12 pr-10 py-3.5 rounded-xl bg-(--color-surface) border border-(--color-border) text-[var(--color-text)] text-[15px] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] transition-colors duration-150"
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

        {/* Results directly below input */}
        <div className="max-w-2xl mx-auto w-full mt-4 space-y-4">
          {/* Results count */}
          {hasSearched && !loading && !error && (
            <p className="text-[13px] text-[var(--color-text-muted)] text-center">
              {results.length} hasil untuk &lsquo;{query}&rsquo;
            </p>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2">
                  <div className="w-9 h-[52px] skeleton rounded shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-3 w-3/5 rounded" />
                    <div className="skeleton h-2.5 w-2/5 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="text-center py-8">
              <p className="text-sm text-[var(--color-text-secondary)] mb-3">{error}</p>
              <button
                onClick={() => doSearch(query)}
                className="px-4 py-2 text-[13px] font-medium rounded-lg bg-(--color-surface) border border-(--color-border) text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-(--color-border-hover) transition-colors duration-150"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {/* Results list */}
          {!loading && !error && results.length > 0 && (
            <div className="flex flex-col max-h-[40vh] overflow-y-auto">
              {results.slice(0, MAX_RESULTS).map((item, i) => (
                <Link
                  key={`${item.source}-${item.id}-${i}`}
                  id={`search-result-${i}`}
                  href={`/manga/${item.source}/${encodeURIComponent(item.id)}`}
                  onClick={handleClose}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150 group ${i === selectedIndex ? "bg-(--color-surface-hover)" : "hover:bg-(--color-surface-hover)"}`}
                >
                  {/* Thumbnail */}
                  <div className="w-10 h-13 shrink-0 rounded overflow-hidden bg-(--color-surface)">
                    {item.cover ? (
                      <img
                        src={proxyCover(item.cover)}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-[var(--color-text-muted)]">
                        ?
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-[var(--color-text)] truncate group-hover:text-(--color-text) transition-colors">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.chapter && (
                        <span className="text-[11px] text-[var(--color-text-muted)]">
                          Ch. {item.chapter}
                        </span>
                      )}
                      <span className="text-[10px] uppercase tracking-wider text-(--color-text-muted)">
                        {item.source}
                      </span>
                    </div>
                  </div>
                  {/* Arrow */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </Link>
              ))}

              {/* View all link */}
              {results.length > MAX_RESULTS && (
                <button
                  onClick={() => {
                    router.push(`/search?q=${encodeURIComponent(query)}`);
                    handleClose();
                  }}
                  className="mt-1 py-2.5 text-[13px] font-medium text-accent hover:text-accent-hover transition-colors duration-150 text-center"
                >
                  Lihat Semua ({results.length} hasil)
                </button>
              )}
            </div>
          )}

          {/* Empty results */}
          {!loading && !error && hasSearched && results.length === 0 && (
            <EmptyState title={`Tidak ditemukan hasil untuk '${query}'`} />
          )}

          {/* Placeholder */}
          {!hasSearched && !loading && (
            <EmptyState title="Ketik judul manhwa untuk mulai mencari" />
          )}
        </div>
      </div>
    </div>
  );
}
