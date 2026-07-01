"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { timeAgo } from "@/lib/timeAgo";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ── Types ── */

interface Overview {
  totalChaptersSent: number;
  totalMangaTracked: number;
  averageChaptersPerDay: number;
  avgCronDuration: number;
}

interface SourceHealthEntry {
  status: string;
  responseTime: number;
  lastSuccessAt: string;
  lastCheckedAt: string;
  consecutiveFailures: number;
  failuresToday: number;
  successesToday: number;
  lastError: string | null;
  disabledUntil: string | null;
}

interface ServiceItem {
  name: string;
  status: string;
  uptime: string;
  ping?: string;
  indicator?: string;
  note?: string;
  lastError?: string | null;
  disabledUntil?: string | null;
}

interface NetworkGroup {
  name: string;
  open: boolean;
  services: ServiceItem[];
}

interface DailyStat {
  date: string;
  runs: number;
  sentLogs: number;
  failedLogs: number;
  skippedLogs: number;
  chaptersSent: number;
  chaptersSkipped: number;
  shortCircuits: number;
}

interface HealthData {
  networks: NetworkGroup[];
  dailyStats: DailyStat[];
  overallStatus: string;
  lastUpdated: string;
  uptime: string;
  totalIncidents: number;
}

interface CronStatusData {
  outcome?: string;
  timestamp?: string;
  duration?: string;
  sent?: number;
  skipped?: number;
  message?: string;
}

interface DashboardData {
  overview: Overview | null;
  sourceHealth: Record<string, SourceHealthEntry>;
  whitelistCount: number;
  queueLength: number;
  cronStatus: CronStatusData | null;
  fastCronNextRun: number | null;
  health: HealthData | null;
}

/* ── Helpers ── */

function shortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

/* ── Sub-components ── */

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl bg-surface border border-border p-5 flex flex-col gap-1">
      <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{label}</p>
      <p className="text-3xl font-bold tabular-nums leading-tight" style={color ? { color } : undefined}>
        {value}
      </p>
      {sub && <p className="text-xs text-text-muted">{sub}</p>}
    </div>
  );
}

function CronCountdown({ nextRun, lastRun }: { nextRun: number | null; lastRun: CronStatusData | null }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!nextRun) return null;

  const diff = Math.max(0, Math.floor((nextRun * 1000 - now) / 1000));
  const mins = Math.floor(diff / 60);
  const secs = Math.floor(diff % 60);
  const INTERVAL = 600; // 10 menit
  const elapsed = lastRun?.timestamp ? (now - new Date(lastRun.timestamp).getTime()) / 1000 : 0;
  const progress = Math.min(elapsed / INTERVAL, 1);
  const statusOk = lastRun?.outcome === "ok";

  return (
    <section className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-(--color-text)">Fast Cron</h2>
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${statusOk ? "text-green-500" : "text-red-500"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusOk ? "bg-green-500" : "bg-red-500"}`} />
          {statusOk ? "Active" : lastRun?.outcome || "Unknown"}
        </span>
      </div>

      <div className="text-center py-3">
        <span className="text-4xl font-bold tabular-nums text-(--color-text) tracking-wider">
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </span>
        <p className="text-xs text-(--color-text-muted) mt-1">Next run</p>
      </div>

      <div className="h-1.5 rounded-full bg-(--color-surface-hover) overflow-hidden">
        <div
          className="h-full rounded-full bg-(--color-accent) transition-all duration-1000"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-(--color-text-muted) mt-3">
        <span>Last: {lastRun?.timestamp ? timeAgo(lastRun.timestamp) : "—"}</span>
        <span>
          {lastRun?.duration ? `${lastRun.duration}s` : ""}
          {lastRun && (lastRun.skipped ?? 0) > 0 ? ` · ${lastRun.skipped} skipped` : ""}
        </span>
      </div>
    </section>
  );
}

function HealthBadge({ status }: { status: string }) {
  const colors: Record<string, string> = { healthy: "#22c55e", degraded: "#f59e0b", down: "#ef4444", error: "#ef4444" };
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium" style={{ backgroundColor: (colors[status] || "#888") + "18", color: colors[status] || "#888" }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors[status] || "#888" }} />
      {status}
    </span>
  );
}

function ServiceRow({ svc }: { svc: ServiceItem }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-(--color-surface-hover)">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-sm font-medium text-(--color-text) truncate">{svc.name}</span>
        <HealthBadge status={svc.status} />
      </div>
      <div className="flex items-center gap-4 text-xs text-(--color-text-muted) tabular-nums shrink-0 ml-3">
        {svc.ping && <span>{svc.ping}</span>}
        <span>{svc.uptime}</span>
        {svc.note && <span className="max-w-[200px] truncate text-(--color-text-muted)/70">{svc.note}</span>}
      </div>
    </div>
  );
}

function NetworkSection({ network }: { network: NetworkGroup }) {
  return (
    <section className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 space-y-3">
      <h2 className="text-sm font-semibold text-(--color-text)">{network.name}</h2>
      <div className="space-y-2">
        {network.services.map((svc) => (
          <ServiceRow key={svc.name} svc={svc} />
        ))}
      </div>
    </section>
  );
}

/* ── Skeleton ── */

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-7 w-36 rounded" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 space-y-2">
            <div className="skeleton h-3 w-16 rounded" />
            <div className="skeleton h-8 w-20 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 space-y-3">
          <div className="skeleton h-5 w-32 rounded" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <div className="skeleton h-4 w-24 rounded" />
              <div className="skeleton h-4 w-20 rounded" />
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 space-y-3">
          <div className="skeleton h-5 w-32 rounded" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <div className="skeleton h-4 w-32 rounded" />
              <div className="skeleton h-4 w-16 rounded" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 space-y-3">
        <div className="skeleton h-5 w-32 rounded" />
        <div className="skeleton h-20 w-full rounded" />
      </div>
    </div>
  );
}

/* ── Page ── */

export default function DashboardPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async (): Promise<DashboardData> => {
      const res = await fetch("/api/reader/dashboard");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (!body.success || !body.data) throw new Error(body.error || "Failed to load dashboard");
      return body.data;
    },
  });

  /* ── Loading ── */
  if (isLoading) return <DashboardSkeleton />;

  /* ── Error ── */
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-(--color-text-muted)">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="text-(--color-text) text-lg font-medium">Dashboard unavailable</p>
        <p className="text-(--color-text-muted) text-sm">{error instanceof Error ? error.message : "An error occurred"}</p>
        <button onClick={() => refetch()} className="px-5 py-2 rounded-lg bg-(--color-accent) text-white text-sm font-medium transition-colors cursor-pointer">Retry</button>
      </div>
    );
  }

  if (!data) return <div className="text-center py-20 text-(--color-text-muted)">Dashboard data unavailable</div>;
  const { overview, sourceHealth, queueLength, cronStatus, fastCronNextRun, health } = data;
  const sourceKeys = Object.keys(sourceHealth);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight text-(--color-text)">Status</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label="Total Chapter" value={overview?.totalChaptersSent ?? "—"} sub="Telah dikirim" color="#3b82f6" />
        <StatCard label="Rata-rata" value={overview ? `${overview.averageChaptersPerDay.toFixed(1)}` : "—"} sub="Chapter/hari" color="#22c55e" />
        <StatCard label="Antrian" value={queueLength} sub="Dalam antrian" color="#f59e0b" />
      </div>

      {/* Fast Cron Countdown */}
      <CronCountdown nextRun={fastCronNextRun} lastRun={cronStatus} />

      {/* Health Networks */}
      {health && health.networks && health.networks.length > 0 && (
        <>
          {/* Overall status header */}
          <div className="flex items-center justify-between rounded-xl bg-(--color-surface) border border-(--color-border) p-4">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${health.overallStatus === "healthy" ? "bg-green-500" : "bg-yellow-500"}`} />
              <span className="text-sm font-medium text-(--color-text)">Status Sistem</span>
              <span className="text-xs text-(--color-text-muted) capitalize">{health.overallStatus}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-(--color-text-muted) tabular-nums">
              <span>Uptime: {health.uptime}</span>
              <span>Incidents: {health.totalIncidents}</span>
              <span>Terakhir: {timeAgo(health.lastUpdated)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {health.networks.map((net) => (
              <NetworkSection key={net.name} network={net} />
            ))}
          </div>
        </>
      )}

      {/* Daily Stats */}
      {health && health.dailyStats && health.dailyStats.length > 0 && (
        <section className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 space-y-3">
          <h2 className="text-sm font-semibold text-(--color-text)">Pengiriman Harian</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-(--color-text-muted) border-b border-(--color-border)">
                  <th className="text-left py-2 pr-4 font-medium">Tanggal</th>
                  <th className="text-right px-3 py-2 font-medium">Sent</th>
                  <th className="text-right px-3 py-2 font-medium">Skipped</th>
                  <th className="text-right px-3 py-2 font-medium">Failed</th>
                  <th className="text-right px-3 py-2 font-medium">0-dif</th>
                  <th className="text-right pl-3 py-2 font-medium">Runs</th>
                </tr>
              </thead>
              <tbody>
                {health.dailyStats.slice(0, 7).reverse().map((day) => (
                  <tr key={day.date} className="border-b border-(--color-border) last:border-0 hover:bg-(--color-surface-hover) transition-colors">
                    <td className="py-2.5 pr-4 text-(--color-text) font-medium tabular-nums">{shortDate(day.date)}</td>
                    <td className="py-2.5 px-3 text-right text-(--color-text) tabular-nums">{day.chaptersSent}</td>
                    <td className="py-2.5 px-3 text-right text-(--color-text-muted) tabular-nums">{day.chaptersSkipped}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{day.failedLogs > 0 ? <span className="text-red-500">{day.failedLogs}</span> : <span className="text-(--color-text-muted)">0</span>}</td>
                    <td className="py-2.5 px-3 text-right text-(--color-text-muted) tabular-nums">{day.shortCircuits || 0}</td>
                    <td className="py-2.5 pl-3 text-right text-(--color-text-muted) tabular-nums">{day.runs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Source Response Time */}
      {sourceKeys.length > 0 && (
        <section className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 space-y-4">
          <h2 className="text-sm font-semibold text-(--color-text)">Response Time per Source</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sourceKeys
                  .map((name) => ({ name, responseTime: sourceHealth[name].responseTime || 0 }))
                  .sort((a, b) => b.responseTime - a.responseTime)}
                layout="vertical"
                margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
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
                  formatter={(value) => [`${value}ms`, "Response Time"]}
                />
                <Bar dataKey="responseTime" radius={[0, 4, 4, 0]} maxBarSize={20} fill="#22c55e" fillOpacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Source Health */}
      <section className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 space-y-4">
        <h2 className="text-sm font-semibold text-(--color-text)">Source Health</h2>
        {sourceKeys.length === 0 ? (
          <p className="text-sm text-(--color-text-muted) py-4 text-center">No data</p>
        ) : (
          <div className="space-y-3">
            {sourceKeys.map((name) => {
              const h = sourceHealth[name];
              return (
                <div key={name} className="flex items-center justify-between py-2 px-3 rounded-lg bg-(--color-surface-hover) transition-colors duration-150">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium capitalize text-(--color-text)">{name}</span>
                    <HealthBadge status={h.status} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-(--color-text-muted) tabular-nums">
                    {h.responseTime > 0 && <span>{h.responseTime}ms</span>}
                    <span>{h.successesToday}/{h.successesToday + h.failuresToday} hari ini</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
