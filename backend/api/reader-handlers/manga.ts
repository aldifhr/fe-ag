import { normalizeIkiruUrl } from "../../shared/scrapers/shared.js";
import { fetchReaderManga } from "../../shared/scrapers/secondary/reader.js";
import { fetchIkiruChapters } from "../../shared/scrapers/ikiru/index.js";
import { getIkiruSeries } from "../../shared/scrapers/ikiru/api.js";
import type { Request, Response } from "express";

// ─── Handler ────────────────────────────────────────────────────────

export async function handleManga(req: Request, res: Response) {
  let id = req.query.id as string;
  const url = req.query.url as string;
  const source = (req.query.source as string) || "shinigami";

  if (!id && !url) {
    return res.status(400).json({ error: "Query parameter 'id' or 'url' required" });
  }

  if (id && source === "shinigami" && id.includes("://")) {
    const m = id.match(/\/([0-9a-f-]{36}|\d+)\/?$/i) || id.match(/\/([^/]+)\/?$/);
    if (m) id = m[1];
  }

  if (source === "shinigami" && id) {
    const info = await fetchReaderManga(id);

    const chapters = (info.chapters || []).map((c: any, i: number) => ({
      id: c.chapter_id,
      number: c.chapter_number,
      title: `Chapter ${c.chapter_number}`,
      url: `${info.manga.url || ""}/chapter-${c.chapter_number}`,
      createdAt: c.created_at,
      sortOrder: i,
    }));

    const statusMap: Record<number, string> = { 1: "Ongoing", 2: "Completed", 3: "Hiatus" };
    const mangaStatus = typeof info.manga.status === "number"
      ? (statusMap[info.manga.status] ?? "Unknown")
      : (info.manga.status ?? "Unknown");

    return res.json({
      manga: {
        id,
        ...info.manga,
        cover: info.manga.cover_image_url ?? info.manga.cover_portrait_url ?? info.manga.cover ?? null,
        status: mangaStatus,
        source: "shinigami",
      },
      chapters: [...chapters].sort((a: any, b: any) => Number(b.number) - Number(a.number)),
    });
  }

  if (source === "ikiru" && (url || id)) {
    const targetUrl = url || id;
    const normalizedUrl = normalizeIkiruUrl(targetUrl);
    // Extract slug from URL (e.g., https://06.ikiru.wtf/manga/one-piece/ → one-piece)
    // Or use id directly if it's already a slug (e.g., "one-piece")
    const slug = targetUrl?.match(/\/manga\/([^/]+)/)?.[1] || (targetUrl && !targetUrl.includes("://") ? targetUrl : "") || "";
    const fullUrl = normalizedUrl?.includes("://") ? normalizedUrl : (slug ? `https://06.ikiru.wtf/manga/${slug}/` : "");

    // Use REST API for metadata (fast, clean JSON)
    // B3: If getIkiruSeries already failed, skip fetchIkiruMetadata (it calls getIkiruSeries again internally)
    const series = slug ? await getIkiruSeries(slug) : null;
    const meta = series
      ? { title: series.title, description: series.description, genres: series.genre, status: null, rating: series.rating, cover: series.cover }
      : null;

    // Keep Scrapling for full chapter list (REST API only gives latest chapters)
    const chapters = await fetchIkiruChapters(fullUrl);

    return res.json({
      manga: {
        id: slug || normalizedUrl,
        title: meta?.title || "Unknown",
        cover: meta?.cover || null,
        description: meta?.description || null,
        status: meta?.status || null,
        url: fullUrl,
        source: "ikiru",
        genres: meta?.genres || [],
      },
      chapters: (chapters || []).map((c: any) => {
        const rawNum = String(c.chapter ?? "");
        const numOnly = rawNum.replace(/^chapter\s+/i, "").trim() || rawNum;
        const rawTitle = String(c.title ?? "");
        const cleanTitle = rawTitle.replace(/^chapter\s+/i, "").trim();
        // Extract real Ikiru chapter ID from URL pattern: chapter-{num}.{id}/
        const realId = c.url?.match(/chapter-[\w.-]+\.(\d+)/)?.[1] || numOnly;
        return {
          id: realId,
          number: numOnly,
          title: cleanTitle && cleanTitle !== numOnly ? rawTitle : "",
          url: c.url,
          createdAt: c.updatedTime || null,
        };
      }),
    });
  }

  return res.status(400).json({ error: "Invalid source/id combination" });
}
