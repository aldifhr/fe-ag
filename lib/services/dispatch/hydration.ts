import { ChapterItem } from "../../types.js";
import { normalizeChapterIdentity } from "../../domain.js";
import { fetchIkiruChapters, fetchIkiruMetadata } from "../../scrapers/ikiru/index.js";

export interface IkiruMetaCacheEntry {
  byChapter: Map<string, ChapterItem>;
  fallback: ChapterItem | null;
}

export function isIkiruSource(source = ""): boolean {
  return String(source || "").toLowerCase() === "ikiru";
}

function isMissingStatus(status = ""): boolean {
  const s = String(status || "").trim().toLowerCase();
  return !s || s === "unknown" || s === "n/a" || s === "ongoing"; // "Ongoing" is the default, if it's the only thing we have, might be worth re-checking
}

function isMissingRating(rating = ""): boolean {
  const r = String(rating || "").trim().toLowerCase();
  return !r || r === "n/a" || r === "unknown" || r === "0" || r === "0/10" || r === "0.0";
}

function isMissingDescription(description = ""): boolean {
  const d = String(description || "").trim().toLowerCase();
  return !d || d === "unknown" || d === "n/a" || d.length < 10;
}

export async function hydrateIkiruMetadataIfMissing(
  item: ChapterItem,
  ikiruMetaCache: Map<string, IkiruMetaCacheEntry>,
  deadline?: number,
): Promise<ChapterItem> {
  if (!item || !isIkiruSource(item.source)) return item;
  if (
    !isMissingStatus(item.status || "") && 
    !isMissingRating(item.rating || "") && 
    !isMissingDescription(item.description || "")
  ) {
    return item;
  }

  const mangaUrl = String(item.mangaUrl || "").trim();
  if (!mangaUrl) return item;

  let cached = ikiruMetaCache.get(mangaUrl);

  if (!cached && deadline && Date.now() > deadline - 2000) {
    return item;
  }

  if (!cached) {
    const rows = await fetchIkiruChapters(mangaUrl);
    const byChapter = new Map<string, ChapterItem>();

    for (const row of rows) {
      const chapterKey = normalizeChapterIdentity(row?.chapter);
      if (chapterKey && !byChapter.has(chapterKey)) {
        byChapter.set(chapterKey, row);
      }
    }
    cached = { byChapter, fallback: rows[0] || null };
    ikiruMetaCache.set(mangaUrl, cached);
  }

  const chapterKey = normalizeChapterIdentity(item.chapter);
  const match = (chapterKey && cached.byChapter.get(chapterKey)) || cached.fallback;
  if (!match) {
    // If no match found in chapters but we need metadata, try fetching direct metadata
    try {
      const raw = await fetchIkiruMetadata(mangaUrl);
      if (raw) {
        return {
          ...item,
          status: isMissingStatus(item.status || "") ? (raw.status || item.status) : item.status,
          rating: isMissingRating(item.rating || "") ? (raw.rating || item.rating) : item.rating,
          cover: item.cover || raw.cover || null,
          description: item.description || raw.description || null,
        };
      }
    } catch {
      // Fallback to original item
    }
    return item;
  }

  return {
    ...item,
    status: isMissingStatus(item.status || "") ? (match.status || item.status) : item.status,
    rating: isMissingRating(item.rating || "") ? (match.rating || item.rating) : item.rating,
    cover: item.cover || match.cover || null,
    description: item.description || match.description || null,
  };
}


