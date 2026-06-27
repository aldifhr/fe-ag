import { getHistory, getGroupedHistory, type HistoryEntry } from "@/lib/history";

export interface ReadingStats {
  totalChaptersRead: number;
  totalMangaRead: number;
  totalReadingTime: number;
  favoriteGenres: { genre: string; count: number }[];
  readingStreak: number;
  longestStreak: number;
  chaptersReadToday: number;
  averageChaptersPerDay: number;
  recentActivity: { date: string; chapters: number }[];
}

/** Group history entries by day (YYYY-MM-DD) and count chapters per day. */
function groupByDay(entries: HistoryEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of entries) {
    const day = new Date(e.readAt).toISOString().split("T")[0];
    map.set(day, (map.get(day) ?? 0) + 1);
  }
  return map;
}

/** Calculate current and longest streak from a list of day strings. */
function calculateStreak(days: string[]): { current: number; longest: number } {
  if (days.length === 0) return { current: 0, longest: 0 };

  const sorted = [...new Set(days)].sort().reverse();
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  // Current streak: must include today or yesterday
  let current = 0;
  if (sorted[0] === today || sorted[0] === yesterday) {
    let expected = sorted[0];
    for (const d of sorted) {
      if (d === expected) {
        current++;
        // previous day
        expected = new Date(new Date(expected).getTime() - 86400000).toISOString().split("T")[0];
      } else {
        break;
      }
    }
  }

  // Longest streak: scan full sorted unique days
  const asc = [...new Set(days)].sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < asc.length; i++) {
    const prev = new Date(asc[i - 1]).getTime();
    const curr = new Date(asc[i]).getTime();
    if (curr - prev === 86400000) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  return { current, longest };
}

/** Format minutes as "Xh Ym" or "Xh" or "Ym". */
function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function computeStats(): ReadingStats {
  const entries = getHistory();
  const grouped = getGroupedHistory();

  // Unique chapters: dedupe by mangaId+chapterNumber
  const uniqueChapters = new Set(
    entries.map((e) => `${e.mangaId}:${e.chapterNumber}`)
  );
  const totalChaptersRead = uniqueChapters.size;
  const totalMangaRead = grouped.length;
  const totalReadingTime = totalChaptersRead * 3; // 3 min per chapter estimate

  // Favorite genres: skipped — genre lookup requires detail fetch, add when genre data is cached in history entries
  const favoriteGenres: { genre: string; count: number }[] = [];

  // Day grouping
  const byDay = groupByDay(entries);
  const allDays = Array.from(byDay.keys());

  // Streaks
  const { current: readingStreak, longest: longestStreak } = calculateStreak(allDays);

  // Today
  const today = new Date().toISOString().split("T")[0];
  const chaptersReadToday = byDay.get(today) ?? 0;

  // Last 7 days
  const last7: { date: string; chapters: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
    last7.push({ date: d, chapters: byDay.get(d) ?? 0 });
  }
  const totalLast7 = last7.reduce((s, d) => s + d.chapters, 0);
  const averageChaptersPerDay = Math.round((totalLast7 / 7) * 10) / 10;

  return {
    totalChaptersRead,
    totalMangaRead,
    totalReadingTime,
    favoriteGenres,
    readingStreak,
    longestStreak,
    chaptersReadToday,
    averageChaptersPerDay,
    recentActivity: last7,
  };
}

export { formatMinutes };
