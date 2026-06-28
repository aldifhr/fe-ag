import { searchShngm } from "../../shared/scrapers/secondary/api.js";
import { searchIkiru } from "../../shared/scrapers/ikiru/index.js";
import type { Request, Response } from "express";

// ─── Handler ────────────────────────────────────────────────────────

export async function handleSearch(req: Request, res: Response) {
  const q = (req.query.q as string)?.trim();
  const source = (req.query.source as string) || "all";
  const sort = (req.query.sort as string) || "";
  const status = (req.query.status as string) || "";

  if (!q || q.length < 1) {
    return res.status(400).json({ error: "Query parameter 'q' required" });
  }

  const searchResults: { id: string; title: string; cover: string | null; url: string; source: string; rating?: string | number | null }[] = [];

  const shinigamiSearch = (source === "all" || source === "shinigami")
    ? searchShngm(q, "shinigami", 0, { sort: sort || undefined, status: status || undefined })
    : Promise.resolve(null);

  const ikiruSearch = (source === "all" || source === "ikiru")
    ? searchIkiru(q)
    : Promise.resolve(null);

  const [shngm, ikiru] = await Promise.all([shinigamiSearch, ikiruSearch]);

  if (shngm?.success && shngm.data) {
    for (const item of shngm.data) {
      searchResults.push({ id: item.mangaId ? String(item.mangaId) : item.url, title: item.title, cover: item.cover ?? null, url: item.mangaUrl ?? item.url, source: "shinigami", rating: item.rating ?? null });
    }
  }

  if (ikiru?.success && ikiru.data) {
    for (const item of ikiru.data) {
      const mangaUrl = item.mangaUrl ?? item.url;
      // Use slug as ID for cleaner URLs (e.g., "one-piece" instead of full URL)
      const slug = mangaUrl?.match(/\/manga\/([^/]+)/)?.[1] || mangaUrl || "";
      searchResults.push({ id: slug, title: item.title, cover: item.cover ?? null, url: mangaUrl, source: "ikiru", rating: item.rating ?? null });
    }
  }

  return res.json({ results: searchResults, total: searchResults.length });
}
