import { SECONDARY_SOURCE_URL, normalizeIkiruUrl } from "../shared/scrapers/shared.js";
import { SECONDARY_CONFIG } from "../reader/config.js";
import { fetchWithRetry, JSON_HEADERS, fetchUpdateList, searchShngm } from "../shared/scrapers/secondary/api.js";
import { isAxiosLikeResponse, isSecondaryApiData } from "../shared/scrapers/secondary/types.js";
import { fetchReaderManga } from "../shared/scrapers/secondary/reader.js";
import { scrapeIkiruUpdatesWithMeta, fetchIkiruMetadata, fetchIkiruChapters, searchIkiru } from "../shared/scrapers/ikiru/index.js";
import { parse } from "node-html-parser";
import type { Request, Response } from "express";

// ─── Router ──────────────────────────────────────────────────────────

export default async function handler(req: Request, res: Response) {
  const route = (req.query.route as string) || "";

  try {
    switch (route) {
      case "latest":  return await handleLatest(req, res);
      case "search":  return await handleSearch(req, res);
      case "manga":   return await handleManga(req, res);
      case "pages":   return await handlePages(req, res);
      case "debug":   return await handleDebug(req, res);
      default:        return res.status(404).json({ error: `Unknown route: ${route}` });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}

// ─── Latest ──────────────────────────────────────────────────────────

async function handleLatest(req: Request, res: Response) {
  const page = parseInt(req.query.page as string) || 1;
  const source = (req.query.source as string) || "all";

  const PAGE_SIZE = 50;
  const all: { id: string; title: string; cover: string | null; url: string | null; source: string; chapter?: string; time?: string; chapters?: { number: string; time: string | null }[] }[] = [];

  if (source === "all" || source === "shinigami") {
    const rows = await fetchUpdateList(SECONDARY_SOURCE_URL, undefined);
    for (const row of rows) {
      all.push({
        id: String(row.manga_id),
        title: row.title || "Unknown",
        cover: row.cover_portrait_url || row.cover_image_url || row.cover || null,
        url: row.direct_series_url || null,
        source: "shinigami",
        chapter: String(row.latest_chapter_number ?? ""),
        time: row.latest_chapter_time || row.updated_at || undefined,
        chapters: Array.isArray((row as any).chapters)
          ? (row as any).chapters.slice(0, 2).map((c: any) => ({
              number: String(c.chapter_number ?? ""),
              time: c.created_at || null,
            }))
          : undefined,
      });
    }
  }

  if (source === "all" || source === "ikiru") {
    const ikiruRes = await scrapeIkiruUpdatesWithMeta();
    const items = ikiruRes.results || [];
    for (const item of items) {
      const mangaUrl = item.mangaUrl ?? item.url;
      all.push({
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

  const total = all.length;
  const start = (page - 1) * PAGE_SIZE;
  const results = all.slice(start, start + PAGE_SIZE);

  return res.json({ results, total, page, pageSize: PAGE_SIZE });
}

// ─── Search ──────────────────────────────────────────────────────────

async function handleSearch(req: Request, res: Response) {
  const q = (req.query.q as string)?.trim();
  const source = (req.query.source as string) || "all";

  if (!q || q.length < 1) {
    return res.status(400).json({ error: "Query parameter 'q' required" });
  }

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
}

// ─── Manga Detail ────────────────────────────────────────────────────

async function handleManga(req: Request, res: Response) {
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
      chapters: chapters.sort((a: any, b: any) => Number(b.number) - Number(a.number)),
    });
  }

  if (source === "ikiru" && url) {
    const normalizedUrl = normalizeIkiruUrl(url);
    const meta = await fetchIkiruMetadata(normalizedUrl);
    const chapters = await fetchIkiruChapters(normalizedUrl);

    return res.json({
      manga: {
        id: normalizedUrl,
        title: meta?.title || "Unknown",
        cover: meta?.cover || null,
        description: meta?.description || null,
        status: meta?.status || null,
        url: normalizedUrl,
        source: "ikiru",
        genres: meta?.genres || [],
      },
      chapters: (chapters || []).map((c: any) => ({
        id: c.chapter,
        number: c.chapter,
        title: c.title || `Chapter ${c.chapter}`,
        url: c.url,
        createdAt: c.updatedTime || null,
      })),
    });
  }

  return res.status(400).json({ error: "Invalid source/id combination" });
}

// ─── Pages ───────────────────────────────────────────────────────────

const KNOWN_PATTERNS = [
  (base: string, num: string) => `${base.replace(/\/$/, "")}/chapter-${num}`,
  (base: string, num: string) => `${base.replace(/\/$/, "")}/${num}`,
  (base: string, num: string) => {
    const m = base.match(/(https?:\/\/[^/]+\/manga\/[^/]+)/);
    return m ? `${m[1]}/chapter-${num}` : null;
  },
];

async function tryFetchPages(url: string): Promise<string[]> {
  const response = await fetchWithRetry(url, {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Referer": new URL(url).origin,
  }, 15000);

  if (!isAxiosLikeResponse(response)) return [];
  const html = response.data as string;

  const root = parse(html);
  const images: string[] = [];
  const seen = new Set<string>();

  const addUrl = (u: string) => {
    const clean = u.startsWith("//") ? `https:${u}` : u;
    if (clean && !seen.has(clean) && !clean.includes("icon") && !clean.includes("logo") && !clean.includes("avatar")) {
      seen.add(clean);
      images.push(clean);
    }
  };

  for (const img of root.querySelectorAll("img[src], img[data-src], img[data-lazy-src]")) {
    addUrl(img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || "");
  }

  if (images.length === 0) {
    for (const el of root.querySelectorAll("[data-image], [data-url], [data-srcset]")) {
      const v = el.getAttribute("data-image") || el.getAttribute("data-url") || "";
      if (v) addUrl(v);
    }
  }

  if (images.length === 0) {
    for (const script of root.querySelectorAll("script")) {
      const text = script.textContent || "";
      const matches = text.matchAll(/["'](https?:\/\/[^"']+\.(jpg|jpeg|png|webp))["']/gi);
      for (const m of matches) addUrl(m[1]);
    }
  }

  if (images.length === 0) {
    for (const el of root.querySelectorAll("*[style*='background-image'], *[style*='background']")) {
      const style = el.getAttribute("style") || "";
      const m = style.match(/url\(["']?([^"')]+)["']?\)/);
      if (m) addUrl(m[1]);
    }
  }

  return images;
}

async function handlePages(req: Request, res: Response) {
  const url = req.query.url as string;
  const baseUrl = req.query.baseUrl as string;
  const chapterNum = req.query.chapter as string;
  const source = (req.query.source as string) || "";
  const chapterId = (req.query.chapterId as string) || "";

  // Shinigami: use chapter detail API instead of HTML scraping
  // Auto-resolve chapterId from baseUrl/url + chapter number if not provided
  const isShinigamiUrl = source === "shinigami" || (url && /shinigami|shngm/i.test(url)) || (baseUrl && /shinigami|shngm/i.test(baseUrl));
  if (isShinigamiUrl) {
    let resolvedChapterId = chapterId;

    // Extract mangaId from baseUrl or url (old frontend only sends url)
    const mangaIdMatch = (baseUrl || url || "").match(/\/series\/([0-9a-f-]{36})/i);
    // Extract chapter number from url if not provided (e.g. .../series/{id}/239 or .../chapter-239)
    const resolvedChapterNum = chapterNum || (url || "").match(/\/chapter-(\d+)\s*\/?$/i)?.[1] || (url || "").match(/\/(\d+)\s*\/?$/)?.[1] || "";

    // Auto-resolve: look up chapter list by mangaId + chapter number
    if (!resolvedChapterId && mangaIdMatch && resolvedChapterNum) {
      try {
        const listUrl = `${SECONDARY_SOURCE_URL}/v1/chapter/${mangaIdMatch[1]}/list?page=1&page_size=250&sort_by=chapter_number&sort_order=asc`;
        const listRes = await fetchWithRetry(listUrl, JSON_HEADERS, SECONDARY_CONFIG.REQUEST_TIMEOUT);
        if (isAxiosLikeResponse(listRes)) {
          const chapters = (listRes.data as any)?.data;
          if (Array.isArray(chapters)) {
            const normalize = (v: any) => String(v).replace(/\.0+$/, "").trim();
            const match = chapters.find((c: any) => normalize(c.chapter_number) === normalize(resolvedChapterNum));
            if (match?.chapter_id) resolvedChapterId = match.chapter_id;
          }
        }
      } catch { /* fall through */ }
    }

    if (resolvedChapterId) {
      try {
        const endpoint = `${SECONDARY_SOURCE_URL}/v1/chapter/detail/${resolvedChapterId}`;
        const apiRes = await fetchWithRetry(endpoint, JSON_HEADERS, SECONDARY_CONFIG.REQUEST_TIMEOUT);
        if (isAxiosLikeResponse(apiRes)) {
          const payload = (apiRes.data as any)?.data;
          if (payload?.chapter?.data?.length) {
            const base = payload.base_url || "https://assets.shngm.id";
            const chapterPath = payload.chapter.path || "";
            const images = payload.chapter.data.map((f: string) => `${base}${chapterPath}${f}`);
            return res.json({ images, total: images.length, url: endpoint, chapterId: resolvedChapterId });
          }
        }
      } catch (err) {
        // Fall through to HTML scraping
      }
    }
  }

  if (!url && (!baseUrl || !chapterNum)) {
    return res.status(400).json({ error: "Need 'url' OR ('baseUrl' + 'chapter')" });
  }

  let urlsToTry: string[] = url ? [url] : [];

  if (baseUrl && chapterNum) {
    for (const pattern of KNOWN_PATTERNS) {
      const u = pattern(baseUrl, chapterNum);
      if (u) urlsToTry.push(u);
    }
  }

  urlsToTry = [...new Set(urlsToTry)];

  for (const tryUrl of urlsToTry) {
    try {
      const images = await tryFetchPages(tryUrl);
      if (images.length > 0) {
        return res.json({ images, total: images.length, url: tryUrl });
      }
    } catch {
      continue;
    }
  }

  return res.json({ images: [], total: 0, url: urlsToTry[0] || url, note: "No images extracted from any URL pattern" });
}

// ─── Debug ───────────────────────────────────────────────────────────

async function handleDebug(req: Request, res: Response) {
  const mangaId = req.query.id as string || "1";
  const endpoint = `${SECONDARY_SOURCE_URL}/v1/manga/detail/${mangaId}`;

  const apiRes = await fetchWithRetry(endpoint, JSON_HEADERS, SECONDARY_CONFIG.REQUEST_TIMEOUT);

  if (!isAxiosLikeResponse(apiRes)) {
    return res.json({ error: "Not an Axios-like response", data: null });
  }

  const raw = isSecondaryApiData(apiRes.data) ? apiRes.data : {};
  const rawData = raw as Record<string, unknown>;
  const payload = rawData.data ?? raw;

  const chapterKeys = ["chapters", "latest_chapters", "chapter_list", "chapterList"];
  const foundChapters: Record<string, unknown> = {};

  for (const key of chapterKeys) {
    const val = (payload as Record<string, unknown>)[key];
    if (Array.isArray(val)) {
      foundChapters[key] = { count: val.length, first: val[0] ? Object.keys(val[0] as Record<string, unknown>) : null, sample: val[0] ? (val[0] as Record<string, unknown>) : null };
    } else {
      foundChapters[key] = typeof val;
    }
  }

  for (const key of chapterKeys) {
    const val = (raw as Record<string, unknown>)[key];
    if (Array.isArray(val)) {
      foundChapters[`raw.${key}`] = { count: val.length, first: val[0] ? Object.keys(val[0] as Record<string, unknown>) : null };
    } else {
      foundChapters[`raw.${key}`] = typeof val;
    }
  }

  const nested = (raw as Record<string, unknown>).data as Record<string, unknown> | undefined;
  if (nested) {
    for (const key of chapterKeys) {
      const val = nested[key];
      if (Array.isArray(val)) {
        foundChapters[`nested.${key}`] = { count: val.length, first: val[0] ? Object.keys(val[0] as Record<string, unknown>) : null };
      } else {
        foundChapters[`nested.${key}`] = typeof val;
      }
    }
  }

  return res.json({
    endpoint,
    isAxiosLike: true,
    isSecondaryApiData: isSecondaryApiData(apiRes.data),
    rawType: typeof apiRes.data,
    rawKeys: apiRes.data && typeof apiRes.data === "object" ? Object.keys(apiRes.data as Record<string, unknown>) : null,
    payloadType: typeof payload,
    payloadKeys: payload && typeof payload === "object" ? Object.keys(payload as Record<string, unknown>) : null,
    chapters: foundChapters,
    title: (payload as Record<string, unknown>)?.title,
    cover: (payload as Record<string, unknown>)?.cover_portrait_url,
  });
}
