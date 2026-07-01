"use client";

import { useQuery } from "@tanstack/react-query";

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  source?: string;
  [key: string]: unknown;
}

function LogLevelBadge({ level }: { level: string }) {
  const colors: Record<string, string> = { error: "#ef4444", warn: "#f59e0b", info: "#3b82f6", debug: "#6b7280", verbose: "#6b7280" };
  const bgColors: Record<string, string> = { error: "#ef444418", warn: "#f59e0b18", info: "#3b82f618", debug: "#6b728018", verbose: "#6b728018" };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium uppercase" style={{ backgroundColor: bgColors[level] || "#88818", color: colors[level] || "#888" }}>
      {level}
    </span>
  );
}

export default function LogsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["logs"],
    queryFn: async (): Promise<LogEntry[]> => {
      const res = await fetch("/api/reader/logs");
      if (res.status === 401) throw new Error("Unauthorized — token tidak valid untuk endpoint ini");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (body.error) throw new Error(body.error);
      return body.data ?? body.items ?? body ?? [];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-7 w-24 rounded" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-8 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    const isAuth = error.message?.includes("Unauthorized");
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-(--color-text-muted)">
          {isAuth ? (
            <>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </>
          ) : (
            <>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </>
          )}
        </svg>
        <p className="text-(--color-text) text-lg font-medium">Logs unavailable</p>
        <p className="text-(--color-text-muted) text-sm max-w-md">{error.message}</p>
        {!isAuth && <button onClick={() => refetch()} className="px-5 py-2 rounded-lg bg-(--color-accent) text-white text-sm font-medium transition-colors cursor-pointer">Retry</button>}
      </div>
    );
  }

  const logs = Array.isArray(data) ? data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-(--color-text)">Logs</h1>
        <button onClick={() => refetch()} className="px-3 py-1.5 rounded-lg bg-(--color-surface) border border-(--color-border) text-xs text-(--color-text-muted) hover:text-(--color-text) transition-colors cursor-pointer">
          Refresh
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-xl bg-(--color-surface) border border-(--color-border) p-10 text-center">
          <p className="text-sm text-(--color-text-muted)">No logs yet</p>
        </div>
      ) : (
        <div className="rounded-xl bg-(--color-surface) border border-(--color-border) overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-(--color-border) text-(--color-text-muted)">
                  <th className="text-left py-3 px-4 font-medium">Waktu</th>
                  <th className="text-left py-3 px-3 font-medium">Level</th>
                  <th className="text-left py-3 px-3 font-medium">Source</th>
                  <th className="text-left py-3 pr-4 font-medium">Pesan</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={i} className="border-b border-(--color-border) last:border-0 hover:bg-(--color-surface-hover) transition-colors">
                    <td className="py-2.5 px-4 text-(--color-text-muted) tabular-nums whitespace-nowrap">
                      {log.timestamp ? new Date(log.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                    </td>
                    <td className="py-2.5 px-3"><LogLevelBadge level={log.level || "info"} /></td>
                    <td className="py-2.5 px-3 text-(--color-text-muted)">{log.source || "—"}</td>
                    <td className="py-2.5 pr-4 text-(--color-text) font-mono max-w-lg truncate">{log.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
