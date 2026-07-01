import { NextResponse } from "next/server";

/* ── Types ── */

interface WhitelistItem {
  title: string;
  sources: { url: string; source: string; mark: null | string }[];
  cover: string;
  description: string;
  status: string;
  rating: string;
  _normalizedTitle: string;
  _normalizedUrls: Record<string, unknown>;
}

interface RecentChapter {
  title: string;
  chapter: string;
  url: string;
  source: string;
  sentAt: string;
  cover: string;
  updatedTime: string | null;
}

interface DashboardResponse {
  success: boolean;
  data: {
    whitelist: WhitelistItem[];
    whitelistCount: number;
    recentChapters: RecentChapter[];
    analytics: {
      overview: {
        totalMangaTracked: number;
        totalChaptersSent: number;
        averageChaptersPerDay: number;
        avgCronDuration: number;
      };
      topManga: { title: string; chapters: number }[];
      sourceStats: { source: string; chapters: number }[];
      trends: { date: string; chapters: number }[];
    };
  };
  timestamp: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000";
const TOKEN = "Bearer manhwascan";

/* ── Helpers ── */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function resolveStatus(raw: string | number | null | undefined): string {
  if (raw == null) return "Unknown";
  if (typeof raw === "number") {
    const map: Record<number, string> = { 1: "Ongoing", 2: "Completed", 3: "Hiatus", 4: "Cancelled" };
    return map[raw] || "Unknown";
  }
  const s = String(raw).trim();
  if (!s || s === "0") return "Unknown";
  return s;
}

/* ── Route ── */

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/api/dashboard-snapshot`, {
      headers: { Authorization: TOKEN },
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `Upstream ${res.status}` },
        { status: res.status },
      );
    }

    const body: DashboardResponse = await res.json();
    if (!body.success || !body.data) {
      return NextResponse.json(
        { success: false, error: "No dashboard data available" },
        { status: 503 },
      );
    }

    const { whitelist, recentChapters, analytics } = body.data;

    if (!whitelist?.length) {
      return NextResponse.json(
        { success: false, error: "No catalog data available" },
        { status: 503 },
      );
    }

    // ── Compute stats ──

    // Status distribution
    const statusCounts: Record<string, number> = {};
    // Source distribution (per manga — first source)
    const sourceCounts: Record<string, number> = {};
    // Rating data
    const allRatings: number[] = [];

    for (const item of whitelist) {
      // Status
      const st = resolveStatus(item.status);
      statusCounts[st] = (statusCounts[st] || 0) + 1;

      // Source
      const src = item.sources?.[0]?.source || "unknown";
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;

      // Rating
      const rawRating = item.rating;
      if (rawRating != null && rawRating !== "") {
        const r = Number(rawRating);
        if (!isNaN(r) && r > 0) allRatings.push(r);
      }
    }

    const total = whitelist.length;

    // Status distribution (sorted by count desc)
    const byStatus = Object.entries(statusCounts)
      .map(([label, count]) => ({
        label,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    // Source distribution (top 10)
    const bySource = Object.entries(sourceCounts)
      .map(([label, count]) => ({
        label,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Rating stats
    const avgRating =
      allRatings.length > 0
        ? Math.round((allRatings.reduce((s, v) => s + v, 0) / allRatings.length) * 10) / 10
        : null;

    // Rating distribution (buckets: 0-2, 2-4, 4-6, 6-8, 8-10)
    const ratingBuckets = [
      { range: "0–2", min: 0, max: 2, count: 0 },
      { range: "2–4", min: 2, max: 4, count: 0 },
      { range: "4–6", min: 4, max: 6, count: 0 },
      { range: "6–8", min: 6, max: 8, count: 0 },
      { range: "8–10", min: 8, max: 10, count: 0 },
    ];
    for (const r of allRatings) {
      const bucket = ratingBuckets.find((b) => r >= b.min && r < b.max) || ratingBuckets[ratingBuckets.length - 1];
      bucket.count++;
    }

    // Top rated (top 10)
    const topRated = whitelist
      .filter((item) => {
        const r = Number(item.rating);
        return !isNaN(r) && r > 0;
      })
      .sort((a, b) => {
        const ra = Number(a.rating);
        const rb = Number(b.rating);
        if (isNaN(ra) && isNaN(rb)) return 0;
        if (isNaN(ra)) return 1;
        if (isNaN(rb)) return -1;
        return rb - ra;
      })
      .slice(0, 10)
      .map((item) => ({
        id: slugify(item.title),
        title: item.title,
        cover: item.cover || null,
        rating: Number(item.rating),
      }));

    // Recent updates from dashboard snapshot
    const recentUpdates = (recentChapters ?? [])
      .filter((item) => item.sentAt)
      .slice(0, 10)
      .map((item) => ({
        id: slugify(item.title),
        title: item.title,
        cover: item.cover || null,
        chapter: item.chapter,
        time: item.sentAt,
        source: item.source,
      }));

    return NextResponse.json({
      success: true,
      data: {
        total,
        rated: allRatings.length,
        avgRating,
        byStatus,
        bySource,
        ratingDistribution: ratingBuckets.map((b) => ({
          label: b.range,
          count: b.count,
          percentage: allRatings.length > 0 ? Math.round((b.count / allRatings.length) * 100) : 0,
        })),
        topRated,
        recentUpdates,
        trends: analytics?.trends ?? [],
        sourceStats: analytics?.sourceStats ?? [],
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
