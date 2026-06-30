import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000";
const TOKEN = "Bearer manhwascan";

interface HealthStatusData {
  networks: {
    name: string;
    open: boolean;
    services: {
      name: string;
      status: string;
      uptime: string;
      ping?: string;
      indicator?: string;
      note?: string;
      lastError?: string | null;
      disabledUntil?: string | null;
    }[];
  }[];
  dailyStats: {
    date: string;
    runs: number;
    sentLogs: number;
    failedLogs: number;
    skippedLogs: number;
    chaptersSent: number;
    chaptersSkipped: number;
    shortCircuits: number;
  }[];
  overallStatus: string;
  lastUpdated: string;
  uptime: string;
  totalIncidents: number;
  cronStatus: Record<string, unknown>;
  providerMetrics: unknown[];
  fastCron: unknown;
}

export async function GET() {
  try {
    const [snapRes, healthRes] = await Promise.all([
      fetch(`${API_BASE}/api/dashboard-snapshot`, {
        headers: { Authorization: TOKEN },
        signal: AbortSignal.timeout(20000),
      }),
      fetch(`${API_BASE}/api/health-status`, {
        headers: { Authorization: TOKEN },
        signal: AbortSignal.timeout(10000),
      }),
    ]);

    if (!snapRes.ok) {
      return NextResponse.json(
        { success: false, error: `Dashboard snapshot returned ${snapRes.status}` },
        { status: snapRes.status },
      );
    }

    const snapBody = await snapRes.json();
    if (!snapBody.success || !snapBody.data) {
      return NextResponse.json(
        { success: false, error: "No dashboard snapshot data" },
        { status: 503 },
      );
    }

    let health: HealthStatusData | null = null;
    if (healthRes.ok) {
      const healthBody = await healthRes.json();
      if (healthBody?.networks) health = healthBody as HealthStatusData;
    }

    const { analytics, sourceHealth, recentChapters, whitelistCount, queueLength, cronStatus } = snapBody.data;

    return NextResponse.json({
      success: true,
      data: {
        overview: analytics?.overview ?? null,
        sourceHealth: sourceHealth ?? {},
        recentChapters: (recentChapters ?? []).slice(0, 5),
        whitelistCount: whitelistCount ?? 0,
        queueLength: queueLength ?? 0,
        cronStatus: cronStatus ?? null,
        health,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
