"use client";

import { useQuery } from "@tanstack/react-query";
import { STATUS_COLORS } from "@/components/MangaCard";
import { timeAgo } from "@/lib/timeAgo";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

/* ── Types ── */

interface StatsData {
  total: number;
  rated: number;
  avgRating: number | null;
  byStatus: { label: string; count: number; percentage: number }[];
  bySource: { label: string; count: number; percentage: number }[];
  ratingDistribution: { label: string; count: number; percentage: number }[];
  topRated: { id: string; title: string; cover: string | null; rating: number }[];
  recentUpdates: { id: string; title: string; cover: string | null; chapter: string; time: string; source: string }[];
  trends: { date: string; chapters: number }[];
  sourceStats: { source: string; chapters: number }[];
}

interface StatsResponse {
  success: boolean;
  data?: StatsData;
  error?: string;
}

/* ── Helpers ── */

const RATING_BAR_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#22d3ee"];

function statusColor(label: string): string {
  return STATUS_COLORS[label] || "#6b7280";
}

/* ── Fetch ── */

async function fetchStats(): Promise<StatsData> {
  const res = await fetch("/api/reader/stats");
  if (!res.ok) {
    const body: StatsResponse = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  const body: StatsResponse = await res.json();
  if (!body.success || !body.data) throw new Error(body.error || "Failed to load stats");
  return body.data;
}

/* ── Sub-components ── */

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 flex flex-col gap-1">
      <p className="text-xs font-medium uppercase tracking-wider text-(--color-text-muted)">{label}</p>
      <p
        className="text-3xl font-bold tabular-nums leading-tight"
        style={color ? { color } : undefined}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-(--color-text-muted)">{sub}</p>}
    </div>
  );
}

function BarChart({
  items,
  colorFn,
  maxLabelWidth,
}: {
  items: { label: string; count: number; percentage: number }[];
  colorFn: (label: string, index: number) => string;
  maxLabelWidth?: string;
}) {
  const maxCount = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, idx) => (
        <div key={item.label} className="flex items-center gap-3">
          <span
            className="text-xs font-medium text-(--color-text-secondary) shrink-0 text-right"
            style={{ width: maxLabelWidth || "auto" }}
          >
            {item.label}
          </span>
          <div className="flex-1 h-5 rounded-md bg-(--color-surface-hover) overflow-hidden relative">
            <div
              className="h-full rounded-md transition-all duration-500"
              style={{
                width: `${(item.count / maxCount) * 100}%`,
                backgroundColor: colorFn(item.label, idx),
                opacity: 0.75,
              }}
            />
          </div>
          <span className="text-xs font-medium text-(--color-text) tabular-nums w-12 text-right shrink-0">
            {item.count}
          </span>
          <span className="text-[11px] text-(--color-text-muted) tabular-nums w-10 text-right shrink-0">
            {item.percentage}%
          </span>
        </div>
      ))}
    </div>
  );
}

function TopRatedCard({
  item,
  rank,
}: {
  item: { id: string; title: string; cover: string | null; rating: number };
  rank: number;
}) {
  return (
    <a
      href={`/manga/${encodeURIComponent(item.id)}`}
      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-(--color-surface-hover) transition-colors"
    >
      <span className="text-xs font-bold text-(--color-text-muted) tabular-nums w-5 text-center">
        {rank}
      </span>
      {item.cover ? (
        <img
          src={item.cover}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          className="w-8 h-10 rounded object-cover bg-(--color-surface) shrink-0"
        />
      ) : (
        <div className="w-8 h-10 rounded bg-(--color-surface) shrink-0" />
      )}
      <span className="flex-1 text-sm font-medium text-(--color-text) truncate">{item.title}</span>
      <span className="text-xs font-semibold text-amber-400 tabular-nums shrink-0">
        {item.rating.toFixed(1)}
      </span>
    </a>
  );
}

function UpdateRow({
  item,
}: {
  item: { id: string; title: string; cover: string | null; chapter: string; time: string; source: string };
}) {
  return (
    <a
      href={`/manga/${encodeURIComponent(item.id)}`}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-(--color-surface-hover) transition-colors"
    >
      {item.cover ? (
        <img
          src={item.cover}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          className="w-8 h-10 rounded object-cover bg-(--color-surface) shrink-0"
        />
      ) : (
        <div className="w-8 h-10 rounded bg-(--color-surface) shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-(--color-text) truncate">{item.title}</p>
        <p className="text-xs text-(--color-text-muted)">
          Ch. {item.chapter} &middot; {item.source}
        </p>
      </div>
      <span className="text-[11px] text-(--color-text-muted) tabular-nums shrink-0">{timeAgo(item.time)}</span>
    </a>
  );
}

/* ── Charts ── */

function ChapterTrendsChart({ data }: { data: { date: string; chapters: number }[] }) {
  if (!data || data.length === 0) return <p className="text-sm text-(--color-text-muted) py-4 text-center">No trend data</p>;
  const sliced = data.slice(-14);
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={sliced} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
            tickFormatter={(v: string) => {
              const d = new Date(v);
              return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
            }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(v) => { const d = new Date(v as string); return d.toLocaleDateString("id-ID", { day: "numeric", month: "long" }); }}
            formatter={(value) => [value, "Chapter"]}
          />
          <Bar dataKey="chapters" radius={[4, 4, 0, 0]} maxBarSize={32}>
            {sliced.map((entry, idx) => (
              <Cell
                key={idx}
                fill={entry.chapters > 0 ? "#818cf8" : "var(--color-text-muted)"}
                fillOpacity={entry.chapters > 0 ? 0.85 : 0.3}
              />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SourceChapterChart({ data }: { data: { source: string; chapters: number }[] }) {
  if (!data || data.length === 0) return <p className="text-sm text-(--color-text-muted) py-4 text-center">No source data</p>;
  const maxVal = Math.max(...data.map((d) => d.chapters), 1);

  // Recharts horizontal bar for cleaner look
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={data} layout="vertical" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="source"
            tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value) => [value, "Chapter"]}
          />
          <Bar dataKey="chapters" radius={[0, 4, 4, 0]} maxBarSize={20} fill="#f59e0b" fillOpacity={0.8} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Skeleton ── */

function StatsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-8 w-40 rounded" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 space-y-3">
            <div className="skeleton h-3 w-16 rounded" />
            <div className="skeleton h-8 w-20 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 space-y-3">
            <div className="skeleton h-5 w-32 rounded" />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex gap-3 items-center">
                <div className="skeleton h-3 w-20 rounded" />
                <div className="skeleton flex-1 h-4 rounded" />
                <div className="skeleton h-3 w-8 rounded" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main page ── */

export default function StatsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
    refetchInterval: 60_000,
  });

  if (isLoading) return <StatsSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-(--color-text-muted)">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="text-(--color-text) text-lg font-medium">Statistics unavailable</p>
        <p className="text-(--color-text-muted) text-sm max-w-md">
          {error instanceof Error ? error.message : "An error occurred"}
        </p>
        <button
          onClick={() => refetch()}
          className="px-5 py-2 rounded-lg bg-(--color-accent) text-white text-sm font-medium transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return <div className="text-center py-20 text-(--color-text-muted)">No data available</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-baseline gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-(--color-text)">Statistics</h1>
        <span className="text-sm text-(--color-text-muted)">
          {data.total} judul &middot; {data.rated} ter- rating
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Manga" value={data.total} sub="Semua judul di katalog" />
        <StatCard
          label="Rata-rata Rating"
          value={data.avgRating != null ? data.avgRating.toFixed(1) : "—"}
          color="#f59e0b"
          sub={data.rated > 0 ? `Dari ${data.rated} judul` : "No ratings yet"}
        />
        {data.byStatus
          .filter((s) => s.label === "Ongoing")
          .map((s) => (
            <StatCard key={s.label} label={s.label} value={s.count} sub={`${s.percentage}% dari total`} color="#22c55e" />
          ))}
        {data.byStatus
          .filter((s) => s.label === "Completed")
          .map((s) => (
            <StatCard key={s.label} label={s.label} value={s.count} sub={`${s.percentage}% dari total`} color="#3b82f6" />
          ))}
      </div>

      {/* Trend charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 space-y-4">
          <h2 className="text-sm font-semibold text-(--color-text)">Chapter per Hari</h2>
          <ChapterTrendsChart data={data.trends} />
        </section>
        <section className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 space-y-4">
          <h2 className="text-sm font-semibold text-(--color-text)">Chapter per Sumber</h2>
          <SourceChapterChart data={data.sourceStats} />
        </section>
      </div>

      {/* Distribution charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status distribution */}
        <section className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 space-y-4">
          <h2 className="text-sm font-semibold text-(--color-text)">Status</h2>
          <BarChart items={data.byStatus} colorFn={(l) => statusColor(l)} maxLabelWidth="5rem" />
        </section>

        {/* Rating distribution */}
        <section className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 space-y-4">
          <h2 className="text-sm font-semibold text-(--color-text)">Distribusi Rating</h2>
          <BarChart
            items={data.ratingDistribution}
            colorFn={(_l, i) => RATING_BAR_COLORS[i] || RATING_BAR_COLORS[0]}
            maxLabelWidth="3rem"
          />
        </section>

        {/* Source distribution */}
        <section className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 space-y-4">
          <h2 className="text-sm font-semibold text-(--color-text)">Sumber</h2>
          <BarChart items={data.bySource} colorFn={() => "#818cf8"} maxLabelWidth="6rem" />
        </section>

        {/* Placeholder untuk card ke-4 atau bisa diisi top/bottom lain */}
        <section className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 space-y-2">
          <h2 className="text-sm font-semibold text-(--color-text) mb-3">Ringkasan</h2>
          {data.byStatus.map((s) => (
            <div key={s.label} className="flex items-center justify-between py-1.5 text-sm">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: statusColor(s.label) }} />
                <span className="text-(--color-text-secondary)">{s.label}</span>
              </span>
              <span className="font-medium text-(--color-text) tabular-nums">
                {s.count}
                <span className="text-xs text-(--color-text-muted) ml-1">({s.percentage}%)</span>
              </span>
            </div>
          ))}
        </section>
      </div>

      {/* Lists: Top Rated + Recent Updates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Rated */}
        <section className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 space-y-1">
          <h2 className="text-sm font-semibold text-(--color-text) mb-3">Rating Tertinggi</h2>
          {data.topRated.length === 0 ? (
            <p className="text-sm text-(--color-text-muted) py-4 text-center">No rating data</p>
          ) : (
            data.topRated.map((item, i) => <TopRatedCard key={item.id} item={item} rank={i + 1} />)
          )}
        </section>

        {/* Recent Updates */}
        <section className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 space-y-1">
          <h2 className="text-sm font-semibold text-(--color-text) mb-3">Update Terbaru</h2>
          {data.recentUpdates.length === 0 ? (
            <p className="text-sm text-(--color-text-muted) py-4 text-center">No updates yet</p>
          ) : (
            data.recentUpdates.map((item) => <UpdateRow key={`${item.id}-${item.chapter}`} item={item} />)
          )}
        </section>
      </div>
    </div>
  );
}
