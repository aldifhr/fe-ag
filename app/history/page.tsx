"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  getGroupedHistory,
  removeMangaHistory,
  removeMultipleMangaHistory,
  clearHistory,
  formatChapters,
  timeAgo,
  GroupedHistory,
} from "@/lib/history";
import { showToast } from "@/lib/toast";
import Link from "next/link";
import { proxyCover } from "@/lib/api";
import EmptyState from "@/components/EmptyState";
import { useOutsideClick } from "@/lib/hooks/useOutsideClick";

/* ─── Time period grouping ─── */

type PeriodKey = "today" | "yesterday" | "thisWeek" | "thisMonth" | "older";

const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: "Hari Ini",
  yesterday: "Kemarin",
  thisWeek: "Minggu Ini",
  thisMonth: "Bulan Ini",
  older: "Sebelumnya",
};

const PERIOD_ORDER: PeriodKey[] = [
  "today",
  "yesterday",
  "thisWeek",
  "thisMonth",
  "older",
];

function getTimePeriod(timestamp: number): PeriodKey {
  const now = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  if (timestamp >= todayMs) return "today";

  const yesterdayMs = todayMs - 86400000;
  if (timestamp >= yesterdayMs) return "yesterday";

  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = todayMs - mondayOffset * 86400000;
  if (timestamp >= monday) return "thisWeek";

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  if (timestamp >= monthStart) return "thisMonth";

  return "older";
}

/* ─── Icons ─── */

function IconBook() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2" />
      <path d="M7 10h10" />
      <path d="M7 14h5" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/* ─── HistoryRow component ─── */

function HistoryRow({
  item,
  onDelete,
  selectMode = false,
  selected = false,
  onToggleSelect,
}: {
  item: GroupedHistory;
  onDelete: (mangaId: string) => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const mangaHref = `/manga/${item.source}/${encodeURIComponent(item.mangaId)}`;
  const chapterCount = item.chapters.length;
  const sourceBadgeStyle =
    item.source === "shinigami"
      ? "bg-black text-red-400"
      : item.source === "ikiru"
        ? "bg-emerald-600 text-white"
        : "bg-(--color-bg) text-(--color-text-muted)";

  const cardContent = (
    <div className="flex gap-3 flex-1 min-w-0">
      {/* Cover + source badge */}
      <div className="relative w-14 shrink-0 rounded-md overflow-hidden bg-(--color-bg) self-start">
        {item.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proxyCover(item.cover)}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-[60px] flex items-center justify-center">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-text-muted)"
              strokeWidth="1.5"
            >
              <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16" />
              <path d="M14 14l1.586-1.586a2 2 0 012.828 0L20 14" />
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
          </div>
        )}
        <span
          className={`absolute top-0.5 left-0.5 px-1 py-[1px] text-[9px] font-semibold rounded-sm leading-none ${sourceBadgeStyle}`}
        >
          {item.source === "shinigami" ? "SG" : item.source === "ikiru" ? "IK" : item.source.slice(0, 2).toUpperCase()}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 py-0.5">
        <p
          className={`text-[14px] font-semibold text-(--color-text) truncate leading-tight transition-colors duration-150 ${
            selectMode ? "cursor-pointer" : "group-hover:text-(--color-accent)"
          }`}
        >
          {item.title}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1 px-1.5 py-[2px] text-[11px] font-medium rounded bg-(--color-accent)/10 text-(--color-accent) leading-none">
            <span>{chapterCount}</span>
            <span>{chapterCount === 1 ? "chapter" : "chapter"}</span>
          </span>
          <span className="text-[12px] text-(--color-text-muted)">·</span>
          <span className="text-[12px] text-(--color-text-muted)">
            {timeAgo(item.latestReadAt)}
          </span>
        </div>
        {chapterCount > 1 && (
          <p className="text-[11px] text-(--color-text-secondary) leading-tight mt-0.5 truncate">
            {formatChapters(item.chapters)}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={`relative flex gap-3 p-3 rounded-xl bg-(--color-surface) border transition-all duration-150 group ${
        selected
          ? "border-(--color-accent) ring-1 ring-(--color-accent)/20"
          : "border-(--color-border) hover:border-(--color-border-hover)"
      } ${selectMode ? "cursor-pointer" : ""}`}
      onClick={selectMode ? onToggleSelect : undefined}
    >
      {/* Select checkbox */}
      {selectMode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.();
          }}
          className={`mt-3 w-[18px] h-[18px] rounded shrink-0 flex items-center justify-center transition-colors duration-150 border ${
            selected
              ? "bg-(--color-accent) border-(--color-accent)"
              : "border-(--color-border) bg-(--color-bg)"
          }`}
          aria-label={selected ? "Batal pilih" : "Pilih"}
        >
          {selected && <IconCheck />}
        </button>
      )}

      {selectMode ? (
        <div className="flex-1 min-w-0 pointer-events-none">{cardContent}</div>
      ) : (
        <Link href={mangaHref} className="flex-1 min-w-0">
          {cardContent}
        </Link>
      )}

      {/* Delete button */}
      {!selectMode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.mangaId);
          }}
          className="self-center p-1.5 rounded-md text-(--color-text-muted) hover:text-(--color-danger) hover:bg-(--color-bg) transition-colors duration-150 opacity-50 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100"
          aria-label="Hapus dari riwayat"
        >
          <IconX />
        </button>
      )}
    </div>
  );
}

/* ─── Main Page ─── */

export default function HistoryPage() {
  const [items, setItems] = useState<GroupedHistory[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const bulkDeleteRef = useRef<HTMLButtonElement | null>(null);

  // Search state
  const [search, setSearch] = useState("");

  useEffect(() => {
    setItems(getGroupedHistory());
    setLoaded(true);
  }, []);

  // Reset confirm state on outside click
  useOutsideClick(confirmRef, () => setConfirmClear(false), confirmClear);
  useOutsideClick(bulkDeleteRef, () => setConfirmBulkDelete(false), confirmBulkDelete);

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearHistory();
    setItems([]);
    setConfirmClear(false);
    showToast("Semua riwayat dihapus");
  };

  const handleDelete = (mangaId: string) => {
    removeMangaHistory(mangaId);
    setItems((prev) => prev.filter((i) => i.mangaId !== mangaId));
    showToast("Dihapus dari riwayat");
  };

  const toggleSelectMode = () => {
    if (selectMode) {
      setSelectMode(false);
      setSelectedIds(new Set());
      setConfirmBulkDelete(false);
    } else {
      setSelectMode(true);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.mangaId)));
    }
  };

  const toggleItem = (mangaId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(mangaId)) {
        next.delete(mangaId);
      } else {
        next.add(mangaId);
      }
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (!confirmBulkDelete) {
      setConfirmBulkDelete(true);
      return;
    }
    const ids = Array.from(selectedIds);
    removeMultipleMangaHistory(ids);
    setItems((prev) => prev.filter((i) => !selectedIds.has(i.mangaId)));
    setSelectedIds(new Set());
    setConfirmBulkDelete(false);
    setSelectMode(false);
    showToast(`${ids.length} manga dihapus dari riwayat`);
  };

  // ── Filter + group ──

  const searchQuery = search.toLowerCase().trim();

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    return items.filter((i) => i.title.toLowerCase().includes(searchQuery));
  }, [items, searchQuery]);

  const grouped = useMemo(() => {
    const map = new Map<PeriodKey, GroupedHistory[]>();
    for (const item of filteredItems) {
      const period = getTimePeriod(item.latestReadAt);
      if (!map.has(period)) map.set(period, []);
      map.get(period)!.push(item);
    }
    // Sort within each period by latestReadAt descending
    for (const [, list] of map) {
      list.sort((a, b) => b.latestReadAt - a.latestReadAt);
    }
    return PERIOD_ORDER.filter((k) => map.has(k)).map((k) => [k, map.get(k)!] as [PeriodKey, GroupedHistory[]]);
  }, [filteredItems]);

  // ── Stats ──

  const stats = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const totalChapters = items.reduce((sum, i) => sum + i.chapters.length, 0);
    const recent7d = items.filter((i) => i.latestReadAt >= sevenDaysAgo).length;
    return { totalManga: items.length, totalChapters, recent7d };
  }, [items]);

  // ── Loading state ──

  if (!loaded) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold tracking-tight">Riwayat Baca</h1>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-4 p-3 rounded-xl bg-(--color-surface) border border-(--color-border) animate-pulse"
            >
              <div className="skeleton w-14 h-[60px] rounded-md shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="skeleton h-4 w-2/3 rounded" />
                <div className="skeleton h-3 w-1/3 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Riwayat Baca</h1>
          {items.length > 0 && (
            <p className="text-[13px] text-(--color-text-muted) mt-0.5">
              {items.length} manga
            </p>
          )}
        </div>
        {items.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectMode}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors duration-150 border ${
                selectMode
                  ? "text-(--color-text) bg-(--color-surface) border-(--color-border)"
                  : "text-(--color-text-muted) hover:bg-(--color-surface) border-(--color-border)"
              }`}
            >
              {selectMode ? "Batal" : "Pilih"}
            </button>
            {!selectMode && (
              <button
                ref={confirmRef}
                onClick={handleClear}
                className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors duration-150 border ${
                  confirmClear
                    ? "text-white bg-(--color-danger) border-(--color-danger) hover:opacity-90"
                    : "text-(--color-danger) hover:bg-(--color-surface) border-(--color-border)"
                }`}
              >
                {confirmClear ? "Yakin hapus?" : "Hapus Semua"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Search ── */}
      {items.length > 0 && (
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-(--color-text-muted)">
            <IconSearch />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari judul manga..."
            className="w-full rounded-xl bg-(--color-surface) border border-(--color-border) pl-10 pr-4 py-2.5 text-sm text-(--color-text) placeholder:text-(--color-text-muted) outline-none transition-colors focus:border-(--color-accent)"
          />
        </div>
      )}

      {/* ── Stats row ── */}
      {items.length > 0 && (
        <div className="flex items-center gap-4 sm:gap-6 text-[13px]">
          <div className="flex items-center gap-1.5 text-(--color-text-muted)">
            <span className="text-[#60a5fa]"><IconBook /></span>
            <span className="font-medium text-(--color-text)">{stats.totalManga}</span>
            <span>manga</span>
          </div>
          <div className="flex items-center gap-1.5 text-(--color-text-muted)">
            <span className="text-[#a78bfa]"><IconLayers /></span>
            <span className="font-medium text-(--color-text)">{stats.totalChapters}</span>
            <span>chapter</span>
          </div>
          <div className="flex items-center gap-1.5 text-(--color-text-muted)">
            <span className="text-[#fbbf24]"><IconClock /></span>
            <span className="font-medium text-(--color-text)">{stats.recent7d}</span>
            <span className="hidden sm:inline">aktivitas 7 hari</span>
            <span className="sm:hidden">/7hari</span>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {filteredItems.length === 0 && items.length > 0 && (
        <EmptyState
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          }
          title={`Tidak ada hasil untuk "${search}"`}
          subtitle="Coba kata kunci lain"
        />
      )}

      {items.length === 0 && (
        <EmptyState
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
          title="Belum ada riwayat baca"
          subtitle="Mulai baca manga untuk melihat riwayat di sini"
        />
      )}

      {/* ── History list ── */}
      {filteredItems.length > 0 && (
        <div className={`space-y-6 ${selectMode ? "pb-20" : "pb-6"}`}>
          {grouped.map(([period, periodItems]) => (
            <section key={period}>
              <h2
                className="sticky top-0 z-10 py-2 text-sm font-bold text-(--color-text) bg-(--color-bg) border-b border-(--color-border) flex items-center gap-2"
              >
                {PERIOD_LABELS[period]}
                <span className="text-[11px] font-normal text-(--color-text-muted)">
                  ({periodItems.length})
                </span>
              </h2>
              <div className="space-y-2 pt-3">
                {periodItems.map((item) => (
                  <HistoryRow
                    key={item.mangaId}
                    item={item}
                    onDelete={handleDelete}
                    selectMode={selectMode}
                    selected={selectedIds.has(item.mangaId)}
                    onToggleSelect={() => toggleItem(item.mangaId)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── Fixed bottom bar (select mode) ── */}
      {selectMode && filteredItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-20 px-4 py-3 bg-(--color-bg)/90 backdrop-blur-md border-t border-(--color-border) flex items-center justify-between gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <span className="text-sm font-medium text-(--color-text) shrink-0">
            {selectedIds.size} dipilih
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectAll}
              className="px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors duration-150 border text-(--color-text-muted) hover:bg-(--color-surface) border-(--color-border)"
            >
              {selectedIds.size === filteredItems.length
                ? "Batal Pilih"
                : "Pilih Semua"}
            </button>
            {selectedIds.size > 0 && (
              <button
                ref={bulkDeleteRef}
                onClick={handleBulkDelete}
                className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors duration-150 border ${
                  confirmBulkDelete
                    ? "text-white bg-(--color-danger) border-(--color-danger) hover:opacity-90"
                    : "text-(--color-danger) hover:bg-(--color-surface) border-(--color-danger)"
                }`}
              >
                {confirmBulkDelete
                  ? `Yakin hapus ${selectedIds.size}?`
                  : `Hapus (${selectedIds.size})`}
              </button>
            )}
            <button
              onClick={toggleSelectMode}
              className="px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors duration-150 bg-(--color-surface) border border-(--color-border) text-(--color-text-muted) hover:text-(--color-text)"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
