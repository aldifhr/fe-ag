"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getWhitelist, type SearchResult } from "@/lib/api";
import MangaCard from "@/components/MangaCard";

const GRID_CLASS = "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3";

const STATUS_MAP: Record<number, string> = { 1: "Ongoing", 2: "Completed", 3: "Hiatus", 4: "Cancelled" };
const STATUS_OPTIONS = ["All", "Ongoing", "Completed", "Hiatus", "Cancelled"];

function normalizeStatus(s: string | number | null | undefined): string | null {
  if (s == null) return null;
  if (typeof s === "number") return STATUS_MAP[s] ?? null;
  return s;
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV(items: SearchResult[]) {
  const headers = ["Title", "Status", "Rating", "Source"];
  const rows = items.map((i) => [
    `"${i.title.replace(/"/g, '""')}"`,
    normalizeStatus(i.status) || "",
    i.rating ?? "",
    i.source || "",
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  download(csv, "whitelist.csv", "text/csv");
}

function exportJSON(items: SearchResult[]) {
  const data = items.map((i) => ({
    title: i.title,
    id: i.id,
    status: normalizeStatus(i.status),
    rating: i.rating,
    source: i.source,
    cover: i.cover,
  }));
  download(JSON.stringify(data, null, 2), "whitelist.json", "application/json");
}

export function WhitelistClient() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["whitelist"],
    queryFn: () => getWhitelist(1, 100),
  });

  const [statusFilter, setStatusFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("");
  const [ratingMin, setRatingMin] = useState("");
  const [ratingMax, setRatingMax] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportOpen) return;
    function onDocClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [exportOpen]);

  const items = data ?? [];

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== "All" && normalizeStatus(item.status) !== statusFilter) return false;
      if (sourceFilter && !item.source?.toLowerCase().includes(sourceFilter.toLowerCase())) return false;
      if (ratingMin !== "") {
        const r = Number(item.rating);
        if (isNaN(r) || r < Number(ratingMin)) return false;
      }
      if (ratingMax !== "") {
        const r = Number(item.rating);
        if (isNaN(r) || r > Number(ratingMax)) return false;
      }
      return true;
    });
  }, [items, statusFilter, sourceFilter, ratingMin, ratingMax]);

  const sources = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => { if (i.source) set.add(i.source); });
    return [...set].sort();
  }, [items]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold tracking-tight text-(--color-text)">Whitelist</h1>
        <div className={GRID_CLASS}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="skeleton aspect-3/4 w-full rounded-lg" />
              <div className="skeleton h-3.5 w-3/4 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold tracking-tight text-(--color-text)">Whitelist</h1>
        <div className="flex flex-col items-center justify-center py-16 text-(--color-text-muted) gap-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm">Gagal mengambil data</p>
          <button onClick={() => refetch()} className="px-4 py-2 text-xs font-medium rounded-lg bg-(--color-accent) text-white hover:opacity-90 transition-opacity">
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Export */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-(--color-text)">Whitelist</h1>
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportOpen((v) => !v)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-(--color-surface) border border-(--color-border) text-(--color-text-secondary) hover:text-(--color-text) hover:border-(--color-border-hover) transition-colors duration-150 inline-flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
          </button>
          {exportOpen && (
            <div className="absolute right-0 mt-1 w-36 rounded-lg bg-(--color-surface) border border-(--color-border) shadow-lg overflow-hidden z-10">
              <button
                onClick={() => { exportCSV(filtered); setExportOpen(false); }}
                className="w-full px-3 py-2 text-xs text-left text-(--color-text-secondary) hover:text-(--color-text) hover:bg-(--color-surface-hover) transition-colors"
              >
                Export CSV
              </button>
              <button
                onClick={() => { exportJSON(filtered); setExportOpen(false); }}
                className="w-full px-3 py-2 text-xs text-left text-(--color-text-secondary) hover:text-(--color-text) hover:bg-(--color-surface-hover) transition-colors"
              >
                Export JSON
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-lg bg-(--color-surface) border border-(--color-border) text-(--color-text) focus:outline-none focus:ring-1 focus:ring-(--color-accent) transition-colors"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === "All" ? "Status: All" : s}</option>
          ))}
        </select>

        {/* Source filter */}
        <div className="relative">
          <input
            list="sources"
            placeholder="Source..."
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="w-28 px-2.5 py-1.5 text-xs rounded-lg bg-(--color-surface) border border-(--color-border) text-(--color-text) placeholder:text-(--color-text-muted) focus:outline-none focus:ring-1 focus:ring-(--color-accent) transition-colors"
          />
          <datalist id="sources">
            {sources.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        {/* Rating range */}
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={10}
            step={0.1}
            placeholder="Rating ≥"
            value={ratingMin}
            onChange={(e) => setRatingMin(e.target.value)}
            className="w-20 px-2 py-1.5 text-xs rounded-lg bg-(--color-surface) border border-(--color-border) text-(--color-text) placeholder:text-(--color-text-muted) focus:outline-none focus:ring-1 focus:ring-(--color-accent) transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-(--color-text-muted) text-xs">–</span>
          <input
            type="number"
            min={0}
            max={10}
            step={0.1}
            placeholder="Rating ≤"
            value={ratingMax}
            onChange={(e) => setRatingMax(e.target.value)}
            className="w-20 px-2 py-1.5 text-xs rounded-lg bg-(--color-surface) border border-(--color-border) text-(--color-text) placeholder:text-(--color-text-muted) focus:outline-none focus:ring-1 focus:ring-(--color-accent) transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        {/* Clear filters */}
        {(statusFilter !== "All" || sourceFilter || ratingMin || ratingMax) && (
          <button
            onClick={() => { setStatusFilter("All"); setSourceFilter(""); setRatingMin(""); setRatingMax(""); }}
            className="px-2.5 py-1.5 text-xs text-(--color-text-muted) hover:text-(--color-text) transition-colors"
          >
            Reset
          </button>
        )}

        <span className="text-xs text-(--color-text-muted) ml-auto">
          {filtered.length} / {items.length}
        </span>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-(--color-text-muted) gap-3">
          <p className="text-sm">Tidak ada hasil</p>
        </div>
      ) : (
        <div className={GRID_CLASS}>
          {filtered.map((item, i) => (
            <MangaCard
              key={`${item.id}-${i}`}
              title={item.title}
              cover={item.cover}
              id={item.id}
              status={item.status}
              rating={item.rating}
            />
          ))}
        </div>
      )}
    </div>
  );
}
