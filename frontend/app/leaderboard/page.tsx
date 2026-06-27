"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getLatest, getPopularToday, SearchResult, proxyCover } from "@/lib/api";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";

type TabKey = "rating" | "popular" | "latest";

const TABS: { key: TabKey; label: string }[] = [
  { key: "rating", label: "Rating Tertinggi" },
  { key: "popular", label: "Paling Populer" },
  { key: "latest", label: "Paling Aktif" },
];

const RANK_COLORS: Record<number, string> = {
  1: "text-amber-500",
  2: "text-emerald-400",
  3: "text-amber-600",
};

function useLeaderboardData(activeTab: TabKey) {
  const ratingQuery = useQuery({
    queryKey: ["leaderboard", "rating"],
    queryFn: () => getLatest("all", 1, "rating"),
    staleTime: 5 * 60 * 1000,
  });

  const popularQuery = useQuery({
    queryKey: ["leaderboard", "popular"],
    queryFn: () => getPopularToday(),
    staleTime: 5 * 60 * 1000,
  });

  const latestQuery = useQuery({
    queryKey: ["leaderboard", "latest"],
    queryFn: () => getLatest("all", 1, "latest"),
    staleTime: 5 * 60 * 1000,
  });

  const map = { rating: ratingQuery, popular: popularQuery, latest: latestQuery };
  const q = map[activeTab];

  return {
    items: q.data ?? [],
    isLoading: q.isLoading,
    error: q.error?.message ?? null,
    refetch: q.refetch,
  };
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
          <div className="skeleton w-8 h-5 rounded" />
          <div className="skeleton w-10 h-14 rounded shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="skeleton h-3.5 w-3/4 rounded" />
            <div className="skeleton h-3 w-1/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  return (
    <span className="px-1.5 py-0.5 text-[10px] font-medium uppercase rounded bg-[var(--color-border)] text-[var(--color-text-muted)] leading-none">
      {source}
    </span>
  );
}

function LeaderboardRow({ rank, item }: { rank: number; item: SearchResult }) {
  const rankColor = RANK_COLORS[rank] ?? "text-[var(--color-text-muted)]";

  return (
    <Link
      href={`/manga/${item.source}/${encodeURIComponent(item.id)}`}
      className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors duration-150 group"
    >
      <span className={`w-8 text-center font-bold text-sm shrink-0 ${rankColor}`}>
        {rank}
      </span>

      {item.cover ? (
        <img
          src={proxyCover(item.cover)}
          alt={item.title}
          className="w-10 h-14 object-cover rounded shrink-0"
          loading="lazy"
        />
      ) : (
        <div className="w-10 h-14 rounded bg-[var(--color-border)] shrink-0" />
      )}

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-[var(--color-text)] line-clamp-1 group-hover:text-[var(--color-accent)] transition-colors duration-150">
          {item.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {item.chapter && (
            <span className="text-[11px] text-[var(--color-text-muted)]">
              Ch. {item.chapter}
            </span>
          )}
          <SourceBadge source={item.source} />
        </div>
      </div>

      {item.rating != null && item.rating !== "" && (
        <div className="flex items-center gap-1 shrink-0">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--color-accent)" stroke="none">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <span className="text-[12px] font-medium text-[var(--color-text)]">
            {item.rating}
          </span>
        </div>
      )}
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20">
      <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 21h8m-4-4v4m-4-8 4-4 4 4" />
          <path d="M12 3v12" />
        </svg>
      </div>
      <p className="text-[var(--color-text-secondary)] text-sm">Tidak ada data leaderboard</p>
    </div>
  );
}

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("rating");
  const { items, isLoading, error, refetch } = useLeaderboardData(activeTab);

  return (
    <div className="space-y-6 max-w-[960px] mx-auto">
      <SectionErrorBoundary>
        <h1 className="text-xl font-semibold tracking-tight">Leaderboard</h1>

        <div className="flex gap-1 p-1 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors duration-150 ${
                activeTab === tab.key
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading && <SkeletonRows />}

        {!isLoading && error && (
          <div className="text-center py-20">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
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

        {!isLoading && !error && items.length === 0 && <EmptyState />}

        {!isLoading && !error && items.length > 0 && (
          <div className="space-y-2">
            {items.map((item, i) => (
              <LeaderboardRow key={`${item.source}-${item.id}-${i}`} rank={i + 1} item={item} />
            ))}
          </div>
        )}
      </SectionErrorBoundary>
    </div>
  );
}
