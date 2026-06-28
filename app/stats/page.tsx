"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { computeStats, formatMinutes, type ReadingStats } from "@/lib/stats";
import { getGroupedHistory, syncHistoryFromApi } from "@/lib/history";
import { proxyCover } from "@/lib/api";

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

/* ─── Icons (inline SVG) ─── */

function IconBook() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2" />
      <path d="M7 10h10" />
      <path d="M7 14h5" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconFlame() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2c.5 2.5 2 4.5 2 7a4 4 0 1 1-8 0c0-2.5 1.5-4.5 2-7 1.5 2 3 3.5 4 0z" />
    </svg>
  );
}

function IconTrophy() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

/* ─── Stat Card ─── */

const CARD_COLORS: Record<string, { icon: string; bg: string }> = {
  chapters: { icon: "text-[#60a5fa]", bg: "bg-[#60a5fa]/10" },
  manga: { icon: "text-[#a78bfa]", bg: "bg-[#a78bfa]/10" },
  time: { icon: "text-[#fbbf24]", bg: "bg-[#fbbf24]/10" },
  streak: { icon: "text-[#f97316]", bg: "bg-[#f97316]/10" },
};

function StatCard({
  icon,
  value,
  label,
  colorKey,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  colorKey: string;
}) {
  const palette = CARD_COLORS[colorKey] ?? CARD_COLORS.chapters;
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-(--color-surface) border border-(--color-border) transition-colors hover:border-(--color-border-hover)">
      <div className={`flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg ${palette.bg}`}>
        <span className={palette.icon}>{icon}</span>
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold text-(--color-text) leading-tight">{value}</div>
        <div className="text-[11px] text-(--color-text-muted) leading-tight">{label}</div>
      </div>
    </div>
  );
}

/* ─── Top Manga Card ─── */

function TopMangaCard({
  title,
  cover,
  chaptersCount,
  rank,
}: {
  title: string;
  cover: string | null;
  chaptersCount: number;
  rank: number;
}) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-(--color-surface) border border-(--color-border) transition-colors hover:border-(--color-border-hover) hover:bg-(--color-surface-hover)">
      <div className="relative flex-shrink-0 w-10 h-14 rounded-md overflow-hidden bg-(--color-bg)">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proxyCover(cover)}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-(--color-text-muted)">
            <IconBook />
          </div>
        )}
        <span className="absolute -top-0.5 -left-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-(--color-accent) text-white text-[10px] font-bold">
          {rank}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-(--color-text) truncate">{title}</div>
        <div className="text-[11px] text-(--color-text-muted)">{chaptersCount} ch. dibaca</div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */

export default function StatsPage() {
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [topManga, setTopManga] = useState<{ title: string; cover: string | null; count: number }[]>([]);

  useEffect(() => {
    (async () => {
      await syncHistoryFromApi();
      setStats(computeStats());
      const grouped = getGroupedHistory();
    const sorted = [...grouped]
      .sort((a, b) => b.chapters.length - a.chapters.length)
      .slice(0, 5)
      .map((g) => ({ title: g.title, cover: g.cover, count: g.chapters.length }));
    setTopManga(sorted);
    })();
  }, []);

  if (!stats) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center text-(--color-text-muted) py-20">
          Memuat...
        </div>
      </main>
    );
  }

  if (stats.totalChaptersRead === 0) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-(--color-text) mb-1">
          Statistik Membaca
        </h1>
        <p className="text-sm text-(--color-text-muted) mb-8">
          Ringkasan aktivitas baca kamu
        </p>
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="text-(--color-text-muted)">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <p className="text-(--color-text-muted)">
            Belum ada data membaca. Mulai baca manhwa untuk melihat statistik!
          </p>
          <Link
            href="/"
            className="px-4 py-2 text-sm font-medium rounded-lg bg-(--color-accent) text-white hover:opacity-90 transition-opacity"
          >
            Mulai Baca
          </Link>
        </div>
      </main>
    );
  }

  const maxChapters = Math.max(
    ...stats.recentActivity.map((d) => d.chapters),
    1,
  );
  const today = new Date().toISOString().split("T")[0];

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {/* ── Page Title ── */}
      <h1 className="text-2xl font-bold text-(--color-text) mb-1">
        Statistik Membaca
      </h1>
      <p className="text-sm text-(--color-text-muted) mb-8">
        Ringkasan aktivitas baca kamu
      </p>

      {/* ── Hero Section ── */}
      <div className="relative overflow-hidden rounded-2xl bg-(--color-surface) border border-(--color-border) p-6 mb-6">
        {/* Decorative gradient blob */}
        <div className="pointer-events-none absolute -top-12 -right-12 w-40 h-40 rounded-full bg-(--color-accent) opacity-[0.07] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-[#a78bfa] opacity-[0.05] blur-3xl" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Left: streak visual */}
          <div className="flex items-center gap-4">
            <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/10 border border-orange-500/20">
              <IconFlame />
              <span className="absolute text-orange-500">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2c.5 2.5 2 4.5 2 7a4 4 0 1 1-8 0c0-2.5 1.5-4.5 2-7 1.5 2 3 3.5 4 0z" />
                </svg>
              </span>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-(--color-text) leading-none">
                {stats.readingStreak}
              </div>
              <div className="text-xs text-orange-500 font-medium mt-0.5">
                hari streak{stats.readingStreak === 1 ? "" : ""}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-12 bg-(--color-border)" />

          {/* Right: today's activity */}
          <div className="flex-1">
            <div className="text-xs text-(--color-text-muted) uppercase tracking-wider font-medium mb-1.5">
              Hari Ini
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-(--color-text)">
                {stats.chaptersReadToday}
              </span>
              <span className="text-sm text-(--color-text-muted)">
                chapter dibaca
              </span>
            </div>
            {stats.chaptersReadToday === 0 && (
              <p className="text-xs text-(--color-text-muted) mt-1 italic">
                Belum ada bacaan hari ini. Mulai sekarang!
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={<IconBook />}
          value={stats.totalChaptersRead}
          label="Ch. Dibaca"
          colorKey="chapters"
        />
        <StatCard
          icon={<IconLayers />}
          value={stats.totalMangaRead}
          label="Manga"
          colorKey="manga"
        />
        <StatCard
          icon={<IconClock />}
          value={formatMinutes(stats.totalReadingTime)}
          label="Waktu Baca"
          colorKey="time"
        />
        <StatCard
          icon={<IconFlame />}
          value={stats.readingStreak}
          label="Streak Aktif"
          colorKey="streak"
        />
      </div>

      {/* ── Activity Chart ── */}
      <div className="p-5 rounded-2xl bg-(--color-surface) border border-(--color-border) mb-6">
        <h2 className="text-sm font-semibold text-(--color-text) mb-5">
          Aktivitas 7 Hari Terakhir
        </h2>
        <div className="flex items-end gap-1.5 sm:gap-2.5" style={{ height: 140 }}>
          {stats.recentActivity.map((day) => {
            const date = new Date(day.date + "T00:00:00");
            const dayName = DAY_NAMES[date.getDay()];
            const pct =
              day.chapters > 0
                ? Math.max((day.chapters / maxChapters) * 100, 6)
                : 0;
            const isToday = day.date === today;

            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center gap-1.5"
              >
                {/* Count label */}
                <span className="text-[11px] font-medium text-(--color-text-muted) h-4 leading-4">
                  {day.chapters > 0 ? day.chapters : ""}
                </span>

                {/* Bar area */}
                <div className="w-full flex items-end justify-center" style={{ height: 88 }}>
                  {pct > 0 ? (
                    <div
                      className={`w-full max-w-8 rounded-t-md transition-all duration-500 ${
                        isToday
                          ? "bg-gradient-to-t from-(--color-accent) to-(--color-accent)/70 shadow-[0_0_12px_var(--color-accent)/20]"
                          : "bg-(--color-accent)/30"
                      }`}
                      style={{ height: `${pct}%` }}
                    />
                  ) : (
                    <div className="w-full max-w-8 h-px bg-(--color-border)" />
                  )}
                </div>

                {/* Day label */}
                <span
                  className={`text-[11px] leading-none ${
                    isToday
                      ? "font-bold text-(--color-accent)"
                      : "text-(--color-text-muted)"
                  }`}
                >
                  {dayName}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Insights + Top Manga (2-col on desktop) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Reading Insights */}
        <div className="p-5 rounded-2xl bg-(--color-surface) border border-(--color-border)">
          <h2 className="text-sm font-semibold text-(--color-text) mb-4">
            Insight Membaca
          </h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#60a5fa]/10">
                <span className="text-[#60a5fa]"><IconTarget /></span>
              </div>
              <div>
                <div className="text-sm font-bold text-(--color-text)">
                  {stats.averageChaptersPerDay}
                </div>
                <div className="text-[11px] text-(--color-text-muted)">
                  Rata-rata ch/hari (7 hari)
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#f97316]/10">
                <span className="text-[#f97316]"><IconFlame /></span>
              </div>
              <div>
                <div className="text-sm font-bold text-(--color-text)">
                  {stats.readingStreak} hari
                </div>
                <div className="text-[11px] text-(--color-text-muted)">
                  Streak saat ini
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fbbf24]/10">
                <span className="text-[#fbbf24]"><IconTrophy /></span>
              </div>
              <div>
                <div className="text-sm font-bold text-(--color-text)">
                  {stats.longestStreak > 0 ? `${stats.longestStreak} hari` : "—"}
                </div>
                <div className="text-[11px] text-(--color-text-muted)">
                  Streak terpanjang
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Manga */}
        <div className="p-5 rounded-2xl bg-(--color-surface) border border-(--color-border)">
          <h2 className="text-sm font-semibold text-(--color-text) mb-4">
            Top Manga
          </h2>
          {topManga.length > 0 ? (
            <div className="space-y-2">
              {topManga.map((m, i) => (
                <TopMangaCard
                  key={m.title}
                  title={m.title}
                  cover={m.cover}
                  chaptersCount={m.count}
                  rank={i + 1}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-(--color-text-muted) py-6 text-center">
              Belum ada data manga
            </p>
          )}
        </div>
      </div>

      {/* ── Footer link ── */}
      <div className="text-center">
        <Link
          href="/"
          className="text-sm text-(--color-text-muted) hover:text-(--color-text) transition-colors"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </main>
  );
}
