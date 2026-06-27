"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { computeStats, formatMinutes, type ReadingStats } from "@/lib/stats";

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
      <div className="text-[var(--color-accent)]">{icon}</div>
      <span className="text-2xl font-bold text-[var(--color-text)]">{value}</span>
      <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
    </div>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState<ReadingStats | null>(null);

  useEffect(() => {
    setStats(computeStats());
  }, []);

  if (!stats) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center text-[var(--color-text-muted)] py-20">Memuat...</div>
      </main>
    );
  }

  if (stats.totalChaptersRead === 0) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[var(--color-text)] mb-1">Statistik Membaca</h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-8">Ringkasan aktivitas baca kamu</p>
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="text-[var(--color-text-muted)]">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <p className="text-[var(--color-text-muted)]">Belum ada data membaca. Mulai baca manhwa untuk melihat statistik!</p>
          <Link href="/" className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity">
            Mulai Baca
          </Link>
        </div>
      </main>
    );
  }

  const maxChapters = Math.max(...stats.recentActivity.map((d) => d.chapters), 1);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-[var(--color-text)] mb-1">Statistik Membaca</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-8">Ringkasan aktivitas baca kamu</p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          }
          value={stats.totalChaptersRead}
          label="Ch. Dibaca"
        />
        <StatCard
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="2" />
              <path d="M7 10h10" />
              <path d="M7 14h5" />
            </svg>
          }
          value={stats.totalMangaRead}
          label="Manga"
        />
        <StatCard
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
          value={formatMinutes(stats.totalReadingTime)}
          label="Waktu Baca"
        />
        <StatCard
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          }
          value={stats.readingStreak}
          label="Hari Streak"
        />
      </div>

      {/* Activity chart */}
      <div className="p-5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] mb-6">
        <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4">Aktivitas 7 Hari Terakhir</h2>
        <div className="flex items-end gap-2 h-32">
          {stats.recentActivity.map((day) => {
            const date = new Date(day.date + "T00:00:00");
            const dayName = DAY_NAMES[date.getDay()];
            const height = day.chapters > 0 ? Math.max((day.chapters / maxChapters) * 100, 8) : 0;
            const isToday = day.date === new Date().toISOString().split("T")[0];
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-[11px] text-[var(--color-text-muted)]">{day.chapters > 0 ? day.chapters : ""}</span>
                <div className="w-full flex items-end justify-center" style={{ height: "100px" }}>
                  {height > 0 ? (
                    <div
                      className={`w-full max-w-[32px] rounded-t-md transition-all ${isToday ? "bg-[var(--color-accent)]" : "bg-[var(--color-accent)] opacity-60"}`}
                      style={{ height: `${height}%` }}
                    />
                  ) : (
                    <div className="w-full max-w-[32px] h-[2px] bg-[var(--color-border)]" />
                  )}
                </div>
                <span className={`text-[11px] ${isToday ? "font-bold text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"}`}>
                  {dayName}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Today + average */}
      <div className="p-5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
        <h2 className="text-sm font-semibold text-[var(--color-text)] mb-3">Hari Ini</h2>
        <p className="text-[var(--color-text-secondary)]">
          <span className="font-bold text-[var(--color-text)]">{stats.chaptersReadToday}</span> chapters dibaca
        </p>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Rata-rata: {stats.averageChaptersPerDay}/hari (7 hari)
        </p>
        {stats.longestStreak > 0 && (
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Streak terpanjang: {stats.longestStreak} hari
          </p>
        )}
      </div>

      <div className="mt-8 text-center">
        <Link href="/" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
          Kembali ke Beranda
        </Link>
      </div>
    </main>
  );
}
