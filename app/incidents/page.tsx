"use client";

import { useQuery } from "@tanstack/react-query";

interface IncidentStats {
  total: number;
  byType: Record<string, number>;
  bySeverity: { critical: number; high: number; medium: number; low: number };
  byStatus: { resolved: number; ongoing: number };
}

interface IncidentsData {
  daysBack: number;
  totalCount: number;
  recent24h: number;
  ongoingCount: number;
  stats: IncidentStats;
  timeline: unknown[];
}

function SeverityBadge({ level }: { level: string }) {
  const colors: Record<string, string> = { critical: "#ef4444", high: "#f97316", medium: "#f59e0b", low: "#6b7280" };
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium" style={{ backgroundColor: (colors[level] || "#888") + "18", color: colors[level] || "#888" }}>
      {level}
    </span>
  );
}

export default function IncidentsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["incidents"],
    queryFn: async (): Promise<IncidentsData> => {
      const res = await fetch("/api/reader/incidents");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (!body.success || !body.data) throw new Error(body.error || "Failed to load incidents");
      return body.data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-7 w-36 rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 space-y-2">
              <div className="skeleton h-3 w-16 rounded" />
              <div className="skeleton h-8 w-12 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-(--color-text-muted)">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="text-(--color-text) text-lg font-medium">Incidents unavailable</p>
        <p className="text-(--color-text-muted) text-sm">{error instanceof Error ? error.message : "An error occurred"}</p>
        <button onClick={() => refetch()} className="px-5 py-2 rounded-lg bg-(--color-accent) text-white text-sm font-medium transition-colors cursor-pointer">Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const { totalCount, recent24h, ongoingCount, stats } = data;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight text-(--color-text)">Incidents</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wider text-(--color-text-muted)">Total</p>
          <p className="text-3xl font-bold tabular-nums text-(--color-text) leading-tight">{totalCount}</p>
          <p className="text-xs text-(--color-text-muted)">30 hari terakhir</p>
        </div>
        <div className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wider text-(--color-text-muted)">24 Hours</p>
          <p className="text-3xl font-bold tabular-nums text-(--color-text) leading-tight">{recent24h}</p>
          <p className="text-xs text-(--color-text-muted)">Baru</p>
        </div>
        <div className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wider text-(--color-text-muted)">Ongoing</p>
          <p className="text-3xl font-bold tabular-nums text-amber-400 leading-tight">{ongoingCount}</p>
          <p className="text-xs text-(--color-text-muted)">Belum selesai</p>
        </div>
        <div className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wider text-(--color-text-muted)">Resolved</p>
          <p className="text-3xl font-bold tabular-nums text-green-400 leading-tight">{stats.byStatus.resolved}</p>
          <p className="text-xs text-(--color-text-muted)">Resolved</p>
        </div>
      </div>

      {/* Severity breakdown */}
      <section className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 space-y-4">
        <h2 className="text-sm font-semibold text-(--color-text)">By Severity</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(stats.bySeverity).map(([level, count]) => (
            <div key={level} className="flex items-center justify-between px-4 py-3 rounded-lg bg-(--color-surface-hover)">
              <SeverityBadge level={level} />
              <span className="text-lg font-bold tabular-nums text-(--color-text)">{count}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Timeline */}
      <section className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 space-y-4">
        <h2 className="text-sm font-semibold text-(--color-text)">Incident History</h2>
        {data.timeline.length === 0 ? (
          <p className="text-sm text-(--color-text-muted) py-8 text-center">No incidents in the last 30 days</p>
        ) : (
          <p className="text-sm text-(--color-text-muted) py-4">TODO: render timeline items</p>
        )}
      </section>
    </div>
  );
}
