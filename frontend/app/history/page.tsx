"use client";
import { useState, useEffect } from "react";
import { getGroupedHistory, clearHistory, formatChapters, timeAgo, GroupedHistory } from "@/lib/history";
import Link from "next/link";

export default function HistoryPage() {
  const [items, setItems] = useState<GroupedHistory[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setItems(getGroupedHistory());
    setLoaded(true);
  }, []);

  const handleClear = () => {
    clearHistory();
    setItems([]);
  };

  if (!loaded) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold tracking-tight">Riwayat Baca</h1>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4 p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
              <div className="skeleton w-14 h-[5.25rem] rounded-md shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="skeleton h-4 w-2/3 rounded" />
                <div className="skeleton h-3 w-1/3 rounded" />
                <div className="skeleton h-3 w-1/4 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Riwayat Baca</h1>
          {items.length > 0 && (
            <p className="text-[13px] text-[var(--color-text-muted)] mt-0.5">
              {items.length} manga dibaca
            </p>
          )}
        </div>
        {items.length > 0 && (
          <button
            onClick={handleClear}
            className="px-3 py-1.5 text-[12px] font-medium rounded-md text-[var(--color-danger)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] transition-colors duration-150"
          >
            Hapus Semua
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="py-20 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <p className="text-[var(--color-text-secondary)] text-sm mb-1">Belum ada riwayat baca</p>
          <p className="text-[var(--color-text-muted)] text-[13px]">Mulai baca manga untuk melihat riwayat di sini</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <HistoryRow key={item.mangaId} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryRow({ item }: { item: GroupedHistory }) {
  const mangaHref = `/manga/${item.source}/${encodeURIComponent(item.mangaId)}`;
  const chapterStr = formatChapters(item.chapters);

  return (
    <Link
      href={mangaHref}
      className="flex gap-4 p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-colors duration-150 group"
    >
      {/* Cover */}
      <div className="w-14 shrink-0 rounded-md overflow-hidden bg-[var(--color-bg)]">
        {item.cover ? (
          <img
            src={item.cover}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-[5.25rem] flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5">
              <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16"/>
              <path d="M14 14l1.586-1.586a2 2 0 012.828 0L20 14"/>
              <rect x="3" y="3" width="18" height="18" rx="2"/>
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <p className="text-[14px] font-medium text-[var(--color-text)] truncate leading-tight group-hover:text-[var(--color-accent)] transition-colors duration-150">
          {item.title}
        </p>
        <p className="text-[13px] text-[var(--color-accent)] font-medium">
          {chapterStr}
        </p>
        <p className="text-[12px] text-[var(--color-text-muted)]">
          {timeAgo(item.latestReadAt)}
        </p>
      </div>
    </Link>
  );
}
