import { searchShngm } from "../../shared/scrapers/secondary/api.js";
import { searchIkiru } from "../../shared/scrapers/ikiru/index.js";
import type { Request, Response } from "express";

export default async function handler(req: Request, res: Response) {
  const q = (req.query.q as string)?.trim();
  const source = (req.query.source as string) || "all";

  if (!q || q.length < 1) {
    return res.status(400).json({ error: "Query parameter 'q' required" });
  }

  try {
    const results: { id: string; title: string; cover: string | null; url: string; source: string }[] = [];

    if (source === "all" || source === "shinigami") {
      const shngm = await searchShngm(q, "shinigami");
      if (shngm.success && shngm.data) {
        for (const item of shngm.data) {
          results.push({ id: item.mangaId ? String(item.mangaId) : item.url, title: item.title, cover: item.cover ?? null, url: item.mangaUrl ?? item.url, source: "shinigami" });
        }
      }
    }

    if (source === "all" || source === "ikiru") {
      const ikiru = await searchIkiru(q);
      if (ikiru.success && ikiru.data) {
        for (const item of ikiru.data) {
          const mangaUrl = item.mangaUrl ?? item.url;
          results.push({ id: mangaUrl, title: item.title, cover: item.cover ?? null, url: mangaUrl, source: "ikiru" });
        }
      }
    }

    return res.json({ results, total: results.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
