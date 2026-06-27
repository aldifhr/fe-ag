import { SECONDARY_SOURCE_URL } from "../shared.js";
import { fetchSecondaryFullMangaInfo } from "./api.js";
import { SECONDARY_PUBLIC_BASE } from "../shared.js";
import { SecondaryChapterRow } from "./types.js";
import { SecondaryMangaRow } from "../../types.js";

interface ReaderMangaResult {
  manga: SecondaryMangaRow & { url: string };
  chapters: SecondaryChapterRow[];
}

/**
 * Fetch manga detail + chapters for the reader API.
 * Wraps fetchSecondaryFullMangaInfo with reader-specific shaping.
 */
export async function fetchReaderManga(mangaId: string | number): Promise<ReaderMangaResult> {
  const info = await fetchSecondaryFullMangaInfo(SECONDARY_SOURCE_URL, mangaId);

  const manga = info.meta ?? info.raw;
  const mangaUrl = `${SECONDARY_PUBLIC_BASE}/series/${mangaId}`;

  return {
    manga: { ...manga, url: mangaUrl },
    chapters: info.chapters,
  };
}
