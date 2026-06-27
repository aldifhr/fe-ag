import { SECONDARY_SOURCE_URL, normalizeIkiruUrl } from "../shared/scrapers/shared.js";
import { SECONDARY_CONFIG } from "../reader/config.js";
import { fetchWithRetry, JSON_HEADERS, fetchUpdateList, searchShngm } from "../shared/scrapers/secondary/api.js";
import { isAxiosLikeResponse, isSecondaryApiData } from "../shared/scrapers/secondary/types.js";
import { fetchReaderManga } from "../shared/scrapers/secondary/reader.js";
import { scrapeIkiruUpdatesWithMeta, fetchIkiruChapters, searchIkiru } from "../shared/scrapers/ikiru/index.js";
import { getIkiruChapterImages, getIkiruPopularToday, getIkiruFilters, getIkiruSeries } from "../shared/scrapers/ikiru/api.js";
import { parse } from "node-html-parser";
import type { Request, Response } from "express";

// ─── Types ──────────────────────────────────────────────────────────

interface LatestResultItem {
  id: string;
  title: string;
  cover: string | null;
  url: string | null;
  source: string;
  chapter?: string;
  time?: string;
  status?: string | number | null;
  rating?: string | number | null;
  chapters?: { number: string; time: string | null }[];
}

// ─── Router ──────────────────────────────────────────────────────────

export default async function handler(req: Request, res: Response) {
  const route = (req.query.route as string) || "";

  try {
    switch (route) {
      case "latest":  return await handleLatest(req, res);
      case "search":  return await handleSearch(req, res);
      case "manga":   return await handleManga(req, res);
      case "pages":   return await handlePages(req, res);
      case "health":  return await handleHealth(req, res);
      case "debug":   return await handleDebug(req, res);
      case "popular":  return await handlePopular(req, res);
      case "filters":  return await handleFilters(req, res);
      case "genres":  return await handleGenres(req, res);
      case "genre-manga": return await handleGenreManga(req, res);
      case "chapter-list": return await handleChapterList(req, res);
      case "random":  return await handleRandom(req, res);
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
  const sort = (req.query.sort as string) || "latest";

  const PAGE_SIZE = 50;

  // B1: Fetch Shinigami and Ikiru in parallel when source="all"
  const shinigamiPromise = (source === "all" || source === "shinigami") ? (async (): Promise<LatestResultItem[]> => {
    const items: LatestResultItem[] = [];
    if (sort === "latest") {
      const rows = await fetchUpdateList(SECONDARY_SOURCE_URL, undefined);
      for (const row of rows) {
        items.push({
          id: String(row.manga_id),
          title: row.title || "Unknown",
          cover: row.cover_portrait_url || row.cover_image_url || row.cover || null,
          url: row.direct_series_url || null,
          source: "shinigami",
          chapter: String(row.latest_chapter_number ?? ""),
          time: row.latest_chapter_time || row.updated_at || undefined,
          status: row.status ?? null,
          rating: row.user_rate ?? null,
          chapters: (row as any).chapters?.slice(0, 2).map((c: any) => ({ number: String(c.chapter_number), time: c.created_at ?? null })),
        });
      }
    } else {
      // popularity / rating — use /v1/manga/list with sort param (no is_update filter)
      const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE), sort });
      const endpoint = `${SECONDARY_SOURCE_URL}/v1/manga/list?${params}`;
      const apiRes = await fetchWithRetry(endpoint, JSON_HEADERS, SECONDARY_CONFIG.REQUEST_TIMEOUT);
      if (isAxiosLikeResponse(apiRes)) {
        const raw = ((apiRes as any).data?.data ?? []) as any[];
        for (const row of raw) {
          items.push({
            id: String(row.manga_id ?? row.id ?? ""),
            title: row.title || "Unknown",
            cover: row.cover_portrait_url || row.cover_image_url || row.cover || null,
            url: row.direct_series_url || null,
            source: "shinigami",
            chapter: String(row.latest_chapter_number ?? ""),
            time: row.latest_chapter_time || row.updated_at || undefined,
            status: row.status ?? null,
            rating: row.user_rate ?? null,
            chapters: row.chapters?.slice(0, 2).map((c: any) => ({ number: String(c.chapter_number), time: c.created_at ?? null })),
          });
        }
      }
    }
    return items;
  })() : Promise.resolve<LatestResultItem[]>([]);

  const ikiruPromise = (source === "all" || source === "ikiru") ? (async (): Promise<LatestResultItem[]> => {
    const items: LatestResultItem[] = [];
    if (sort === "popularity") {
      const popularItems = await getIkiruPopularToday();
      for (const item of popularItems) {
        const mangaUrl = item.permalink;
        const slug = mangaUrl?.match(/\/manga\/([^/]+)/)?.[1] || "";
        const latest = item.latest_chapters?.[0];
        items.push({
          id: slug || mangaUrl || "",
          title: item.title,
          cover: item.cover ?? null,
          url: mangaUrl,
          source: "ikiru",
          chapter: latest ? String(latest.number) : "",
          time: latest?.modified_local || undefined,
          rating: item.rating ?? null,
        });
      }
    } else {
      const ikiruRes = await scrapeIkiruUpdatesWithMeta();
      const ikiruItems = ikiruRes.results || [];
      for (const item of ikiruItems) {
        const mangaUrl = item.mangaUrl ?? item.url;
        const slug = mangaUrl?.match(/\/manga\/([^/]+)/)?.[1] || "";
        items.push({
          id: slug || mangaUrl || "",
          title: item.title,
          cover: item.cover ?? null,
          url: mangaUrl,
          source: "ikiru",
          chapter: item.chapter,
          time: item.updatedTime || undefined,
          rating: item.rating ?? null,
        });
      }
    }
    return items;
  })() : Promise.resolve<LatestResultItem[]>([]);

  const [shinigamiItems, ikiruItems] = await Promise.all([shinigamiPromise, ikiruPromise]);
  const all: LatestResultItem[] = [...shinigamiItems, ...ikiruItems];

  const total = all.length;
  // For popularity/rating the API already paginated; for latest we slice client-side
  const results = sort === "latest" ? all.slice((page - 1) * PAGE_SIZE, (page - 1) * PAGE_SIZE + PAGE_SIZE) : all;

  return res.json({ results, total, page, pageSize: PAGE_SIZE });
}

// ─── Search ──────────────────────────────────────────────────────────

async function handleSearch(req: Request, res: Response) {
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

// ─── Pages ───────────────────────────────────────────────────────────

const KNOWN_PATTERNS = [
  (base: string, num: string) => `${base.replace(/\/$/, "")}/chapter-${num}`,
  (base: string, num: string) => `${base.replace(/\/$/, "")}/${num}`,
  (base: string, num: string) => {
    const m = base.match(/(https?:\/\/[^/]+\/manga\/[^/]+)/);
    return m ? `${m[1]}/chapter-${num}` : null;
  },
];

async function tryFetchPages(url: string, timeoutMs = 15000): Promise<string[]> {
  const response = await fetchWithRetry(url, {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Referer": new URL(url).origin,
  }, timeoutMs);

  if (!isAxiosLikeResponse(response)) return [];
  const html = response.data as string;

  const root = parse(html);
  const images: string[] = [];
  const seen = new Set<string>();

  // Patterns that identify banner/ad images, not real manga content
  const BANNER_RE = /\.(gif)(\?|$)/i;
  const AD_PATH_RE = /\/wp-content\/uploads\/.*\.(gif|png|jpg)(\?|$)/i;
  const AD_KEYWORDS = /banner|slot|casino|sport|betting|koko|pentaslot|ikiru.*\.(gif)/i;

  const addUrl = (u: string) => {
    const clean = u.startsWith("//") ? `https:${u}` : u;
    if (
      !clean || seen.has(clean)
      || /icon|logo|avatar/i.test(clean)
      || BANNER_RE.test(clean)
      || (AD_PATH_RE.test(clean) && AD_KEYWORDS.test(clean))
    ) return;
    seen.add(clean);
    images.push(clean);
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

    // Extract mangaId from baseUrl or url (matches /series/, /manga/, or bare UUID)
    const mangaIdMatch = (baseUrl || url || "").match(/\/(?:series|manga)\/([0-9a-f-]{36})/i)
      || (url || "").match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
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

  // Ikiru: use REST API for chapter images
  const isIkiruUrl = source === "ikiru" || (url && /ikiru\.wtf/i.test(url)) || (baseUrl && /ikiru\.wtf/i.test(baseUrl));
  if (isIkiruUrl) {
    let resolvedId = chapterId;

    // Auto-resolve: extract chapter ID from URL pattern chapter-{num}.{id}/
    if (!resolvedId) {
      const urlToCheck = url || baseUrl || "";
      const idFromUrl = urlToCheck.match(/chapter-[\w.-]+\.(\d+)/)?.[1];
      if (idFromUrl) resolvedId = idFromUrl;
    }

    // Auto-resolve: look up from series endpoint by chapter number
    if (!resolvedId && chapterNum) {
      const slugFromUrl = (url || baseUrl || "").match(/\/manga\/([^/]+)/)?.[1];
      if (slugFromUrl) {
        try {
          const series = await getIkiruSeries(slugFromUrl);
          if (series?.latest_chapters?.length) {
            const match = series.latest_chapters.find((c: any) => String(c.number) === String(chapterNum));
            if (match?.id) resolvedId = String(match.id);
          }
        } catch { /* fall through */ }
      }
    }

    if (resolvedId) {
      try {
        const chapterDetail = await getIkiruChapterImages(resolvedId);
        if (chapterDetail?.images?.length) {
          const images = chapterDetail.images.sort((a, b) => a.page - b.page).map(img => img.url);
          return res.json({ images, total: images.length, url });
        }
      } catch { /* fall through to HTML scraping */ }
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

  // B8: Try all URL patterns in parallel (5s timeout for fallbacks), return first successful result
  const settled = await Promise.allSettled(
    urlsToTry.map(tryUrl =>
      tryFetchPages(tryUrl, 5000).then(images => ({ url: tryUrl, images }))
    )
  );

  for (const result of settled) {
    if (result.status === "fulfilled" && result.value.images.length > 0) {
      return res.json({ images: result.value.images, total: result.value.images.length, url: result.value.url });
    }
  }

  return res.json({ images: [], total: 0, url: urlsToTry[0] || url, note: "No images extracted from any URL pattern" });
}

// ─── Popular (Ikiru) ─────────────────────────────────────────────────

async function handlePopular(_req: Request, res: Response) {
  try {
    const items = await getIkiruPopularToday();
    const results = items.map(item => ({
      id: String(item.id),
      title: item.title,
      cover: item.cover || null,
      url: item.permalink,
      source: "ikiru",
      chapter: item.latest_chapters?.[0] ? String(item.latest_chapters[0].number) : "",
      time: item.latest_chapters?.[0]?.modified_local || null,
    }));
    return res.json({ results, total: results.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.json({ results: [], total: 0, error: message });
  }
}

// ─── Filters (Ikiru) ─────────────────────────────────────────────────

async function handleFilters(_req: Request, res: Response) {
  try {
    const filters = await getIkiruFilters();
    return res.json(filters);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.json({ types: [], genres: [], error: message });
  }
}

// ─── Genres ──────────────────────────────────────────────────────────

async function handleGenres(req: Request, res: Response) {
  try {
    const endpoint = `${SECONDARY_SOURCE_URL}/v1/genre/list`;
    const apiRes = await fetchWithRetry(endpoint, JSON_HEADERS, SECONDARY_CONFIG.REQUEST_TIMEOUT);

    if (!isAxiosLikeResponse(apiRes)) {
      return res.status(502).json({ error: "Failed to fetch genres from Shinigami API" });
    }

    const payload = (apiRes.data as any)?.data ?? [];
    return res.json({ genres: payload });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}

async function handleGenreManga(req: Request, res: Response) {
  try {
    const genre = req.query.genre as string;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.page_size as string) || 20;
    const sort = (req.query.sort as string) || "latest";

    if (!genre) {
      return res.status(400).json({ error: "Query parameter 'genre' (slug) required" });
    }

    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
      genre_include: genre,
      genre_include_mode: "and",
      sort,
    });

    const endpoint = `${SECONDARY_SOURCE_URL}/v1/manga/list?${params}`;
    const apiRes = await fetchWithRetry(endpoint, JSON_HEADERS, SECONDARY_CONFIG.REQUEST_TIMEOUT);

    if (!isAxiosLikeResponse(apiRes)) {
      return res.status(502).json({ error: "Failed to fetch genre manga from Shinigami API" });
    }

    const raw = (apiRes.data as any)?.data ?? [];
    const results = raw.map((item: any) => ({
      id: String(item.manga_id ?? item.id ?? ""),
      title: item.title || "Unknown",
      cover: item.cover_portrait_url || item.cover_image_url || item.cover || null,
      source: "shinigami",
      chapter: String(item.latest_chapter_number ?? ""),
      time: item.latest_chapter_time || item.updated_at || undefined,
    }));

    return res.json({ results, total: (apiRes.data as any)?.total ?? results.length, page, pageSize });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}

// ─── Chapter List (with release_date for schedule analysis) ──────────

async function handleChapterList(req: Request, res: Response) {
  const mangaId = req.query.id as string;
  if (!mangaId) {
    return res.status(400).json({ error: "Query parameter 'id' required" });
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.page_size as string) || 50));
  const endpoint = `${SECONDARY_SOURCE_URL}/v1/chapter/${mangaId}/list?page=${page}&page_size=${pageSize}&sort_by=chapter_number&sort_order=desc`;

  try {
    const apiRes = await fetchWithRetry(endpoint, JSON_HEADERS, SECONDARY_CONFIG.REQUEST_TIMEOUT);
    if (!isAxiosLikeResponse(apiRes)) {
      return res.status(502).json({ error: "Failed to fetch chapter list" });
    }
    const raw = (apiRes.data as any)?.data ?? [];
    const chapters = raw.map((c: any) => ({
      number: String(c.chapter_number ?? ""),
      releaseDate: c.release_date || null,
    }));
    return res.json({ chapters });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}

// ─── Random ──────────────────────────────────────────────────────────

async function handleRandom(_req: Request, res: Response) {
  const randomPage = Math.floor(Math.random() * 50) + 1;
  const params = new URLSearchParams({ page: String(randomPage), page_size: "1", sort: "latest" });
  const endpoint = `${SECONDARY_SOURCE_URL}/v1/manga/list?${params}`;
  const apiRes = await fetchWithRetry(endpoint, JSON_HEADERS, SECONDARY_CONFIG.REQUEST_TIMEOUT);

  if (!isAxiosLikeResponse(apiRes)) {
    return res.status(502).json({ error: "Failed to fetch random manga" });
  }

  const raw = ((apiRes.data as any)?.data ?? []) as any[];
  if (!raw.length) {
    return res.status(404).json({ error: "No manga found" });
  }

  const row = raw[0];
  const result = {
    id: String(row.manga_id ?? row.id ?? ""),
    title: row.title || "Unknown",
    cover: row.cover_portrait_url || row.cover_image_url || row.cover || null,
    source: "shinigami",
    chapter: String(row.latest_chapter_number ?? ""),
    time: row.latest_chapter_time || row.updated_at || undefined,
  };

  return res.json({ result });
}

// ─── Health ──────────────────────────────────────────────────────────

async function handleHealth(_req: Request, res: Response) {
  let shinigami: "ok" | "error" = "error";
  try {
    const endpoint = `${SECONDARY_SOURCE_URL}/v1/manga/list?page=1&page_size=1`;
    const apiRes = await fetchWithRetry(endpoint, JSON_HEADERS, 8000);
    shinigami = isAxiosLikeResponse(apiRes) ? "ok" : "error";
  } catch {
    shinigami = "error";
  }
  return res.json({ shinigami, timestamp: Date.now() });
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
