import {
  normalizeChapterIdentity,
  normalizeSourceUrl,
  normalizeTitleKey,
} from "../../domain.js";
import { ChapterItem, DispatchChapterMeta } from "../../types.js";

export function buildCrossSourceChapterKey(item: ChapterItem): string | null {
  const titleKey = normalizeTitleKey(item?.canonicalTitle || item?.title || "");
  const chapterKey = normalizeChapterIdentity(item?.chapter || "");
  if (!titleKey || !chapterKey) return null;
  return `chapter:dedupe:${titleKey}:${chapterKey}`;
}

export function getUpdatedTimeMs(item: ChapterItem): number | null {
  const ms = new Date(item?.updatedTime ?? "").getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function preferDuplicateMeta(
  existing: DispatchChapterMeta,
  candidate: DispatchChapterMeta,
): DispatchChapterMeta {
  const existingMs = getUpdatedTimeMs(existing?.item);
  const candidateMs = getUpdatedTimeMs(candidate?.item);

  if (
    existingMs !== null &&
    candidateMs !== null &&
    candidateMs !== existingMs
  ) {
    return candidateMs < existingMs ? candidate : existing;
  }

  return existing;
}

export function buildDispatchChapterMeta(matched: ChapterItem[] = []): DispatchChapterMeta[] {
  return matched.map((item) => {
    const normalizedChapterUrl = normalizeSourceUrl(item?.url);
    return {
      item,
      key: normalizedChapterUrl ? `chapter:${normalizedChapterUrl}` : null,
      duplicateKey: buildCrossSourceChapterKey(item),
    };
  });
}
