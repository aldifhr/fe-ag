import { fetchUpdateList } from "../../shared/scrapers/secondary/api.js";
import { SECONDARY_SOURCE_URL } from "../../shared/scrapers/shared.js";
import { scrapeIkiruUpdatesWithMeta } from "../../shared/scrapers/ikiru/index.js";
import type { Request, Response } from "express";

export default async function handler(req: Request, res: Response) {
  const page = parseInt(req.query.page as string) || 1;
  const source = (req.query.source as string) || "all";

  try {
    const results: { id: string; title: string; cover: string | null; url: string | null; source: string; chapter?: string; time?: string }[] = [];

    if (source === "all" || source === "shinigami") {
      const rows = await fetchUpdateList(SECONDARY_SOURCE_URL, undefined);
      for (const row of rows.slice(0, 50)) {
        results.push({
          id: String(row.manga_id),
          title: row.title || "Unknown",
          cover: row.cover_portrait_url || row.cover_image_url || row.cover || null,
          url: row.direct_series_url || null,
          source: "shinigami",
          chapter: String(row.latest_chapter_number ?? ""),
          time: row.latest_chapter_time || row.updated_at || undefined,
        });
      }
    }

    if (source === "all" || source === "ikiru") {
      const ikiruRes = await scrapeIkiruUpdatesWithMeta();
      const items = ikiruRes.results || [];
      for (const item of items.slice(0, 50)) {
        const mangaUrl = item.mangaUrl ?? item.url;
        results.push({
          id: mangaUrl,
          title: item.title,
          cover: item.cover ?? null,
          url: mangaUrl,
          source: "ikiru",
          chapter: item.chapter,
          time: item.updatedTime || undefined,
        });
      }
    }

    return res.json({ results, total: results.length, page });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
