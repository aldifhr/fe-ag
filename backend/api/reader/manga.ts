import { fetchReaderManga } from "../../shared/scrapers/secondary/reader.js";
import { fetchIkiruMetadata, fetchIkiruChapters } from "../../shared/scrapers/ikiru/index.js";
import type { Request, Response } from "express";

export default async function handler(req: Request, res: Response) {
  let id = req.query.id as string;
  const url = req.query.url as string;
  const source = (req.query.source as string) || "shinigami";

  if (!id && !url) {
    return res.status(400).json({ error: "Query parameter 'id' or 'url' required" });
  }

  if (id && source === "shinigami" && id.includes("://")) {
    const m = id.match(/(\d+)\/?$/);
    if (m) id = m[1];
  }

  try {
    if (source === "shinigami" && id) {
      const info = await fetchReaderManga(id);

      const chapters = (info.chapters || []).map((c, i) => ({
        id: c.chapter_id,
        number: c.chapter_number,
        title: `Chapter ${c.chapter_number}`,
        url: `${info.manga.url || ""}/chapter-${c.chapter_number}`,
        createdAt: c.created_at,
        sortOrder: i,
      }));

      return res.json({
        manga: {
          id,
          ...info.manga,
          source: "shinigami",
        },
        chapters: chapters.sort((a, b) => Number(b.number) - Number(a.number)),
      });
    }

    if (source === "ikiru" && url) {
      const meta = await fetchIkiruMetadata(url);
      const chapters = await fetchIkiruChapters(url);

      return res.json({
        manga: {
          id: url,
          title: meta?.title || "Unknown",
          cover: meta?.cover || null,
          description: meta?.description || null,
          status: meta?.status || null,
          url,
          source: "ikiru",
          genres: meta?.genres || [],
        },
        chapters: (chapters || []).map((c) => ({
          id: c.chapter,
          number: c.chapter,
          title: c.title || `Chapter ${c.chapter}`,
          url: c.url,
          createdAt: c.updatedTime || null,
        })),
      });
    }

    return res.status(400).json({ error: "Invalid source/id combination" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
