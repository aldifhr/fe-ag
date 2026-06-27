export interface HistoryEntry {
  mangaId: string;
  title: string;
  cover: string | null;
  source: string;
  chapterNumber: number;
  readAt: number; // timestamp
}

export interface GroupedHistory {
  mangaId: string;
  title: string;
  cover: string | null;
  source: string;
  chapters: number[];
  latestReadAt: number;
}

const STORAGE_KEY = "manhwa-history";
const MAX_ENTRIES = 200;

function safeGetHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Record a chapter read. Moves entry to top, dedupes, caps at MAX_ENTRIES. */
export function addHistory(entry: Omit<HistoryEntry, "readAt">): void {
  const all = safeGetHistory();
  // Remove existing entry for same manga+chapter
  const filtered = all.filter(
    (e) => !(e.mangaId === entry.mangaId && e.chapterNumber === entry.chapterNumber)
  );
  // Add new entry at the start
  filtered.unshift({ ...entry, readAt: Date.now() });
  // Cap length
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, MAX_ENTRIES)));
}

/** Get all history entries. */
export function getHistory(): HistoryEntry[] {
  return safeGetHistory();
}

/**
 * Get history grouped by manga.
 * Each group shows the manga info + sorted chapter numbers + most recent readAt.
 * Groups are sorted by latestReadAt descending (most recently read first).
 */
export function getGroupedHistory(): GroupedHistory[] {
  const entries = safeGetHistory();
  const map = new Map<string, GroupedHistory>();

  for (const e of entries) {
    const existing = map.get(e.mangaId);
    if (existing) {
      if (!existing.chapters.includes(e.chapterNumber)) {
        existing.chapters.push(e.chapterNumber);
      }
      existing.chapters.sort((a, b) => a - b);
      if (e.readAt > existing.latestReadAt) existing.latestReadAt = e.readAt;
    } else {
      map.set(e.mangaId, {
        mangaId: e.mangaId,
        title: e.title,
        cover: e.cover,
        source: e.source,
        chapters: [e.chapterNumber],
        latestReadAt: e.readAt,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.latestReadAt - a.latestReadAt);
}

/** Get read chapter numbers as strings for a specific manga. */
export function getReadChapters(mangaId: string): Set<string> {
  const history = getGroupedHistory();
  const group = history.find(g => g.mangaId === mangaId);
  if (!group) return new Set();
  return new Set(group.chapters.map(String));
}

/** Get the most recently read manga for "Lanjutkan Baca" banner. */
export function getContinueReading(): Omit<HistoryEntry, "readAt"> | null {
  const entries = safeGetHistory();
  return entries.length > 0
    ? { mangaId: entries[0].mangaId, title: entries[0].title, cover: entries[0].cover, source: entries[0].source, chapterNumber: entries[0].chapterNumber }
    : null;
}

/** Get the last read chapter number for a specific manga. Returns null if no history. */
export function getLastReadChapter(mangaId: string): number | null {
  const entries = safeGetHistory();
  const mangaEntries = entries.filter(e => e.mangaId === mangaId);
  return mangaEntries.length > 0 ? mangaEntries[0].chapterNumber : null;
}

/** Mark a chapter as read manually. */
export function markAsRead(mangaId: string, title: string, cover: string | null, source: string, chapterNumber: number): void {
  addHistory({ mangaId, title, cover, source, chapterNumber });
}

/** Remove a specific chapter from read history. */
export function unmarkAsRead(mangaId: string, chapterNumber: number): void {
  const all = safeGetHistory();
  const filtered = all.filter(
    (e) => !(e.mangaId === mangaId && e.chapterNumber === chapterNumber)
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/** Clear all history. */
export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Format chapter list as compact range string: "Ch. 35–40" or "Ch. 5, 10, 15" */
export function formatChapters(chapters: number[]): string {
  if (chapters.length === 0) return "";
  const sorted = [...chapters].sort((a, b) => a - b);

  // Build ranges
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}–${end}`);
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}–${end}`);

  return "Ch. " + ranges.join(", ");
}

/** Relative time string in Indonesian */
export function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes}m lalu`;
  if (hours < 24) return `${hours}j lalu`;
  if (days < 7) return `${days}h lalu`;
  return new Date(timestamp).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}
