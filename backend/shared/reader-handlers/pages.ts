import { SECONDARY_SOURCE_URL } from "../../shared/scrapers/shared.js";
import { SECONDARY_CONFIG } from "../../reader/config.js";
import { fetchWithRetry, JSON_HEADERS } from "../../shared/scrapers/secondary/api.js";
import { isAxiosLikeResponse } from "../../shared/scrapers/secondary/types.js";
import { getIkiruChapterImages, getIkiruSeries } from "../../shared/scrapers/ikiru/api.js";
import { parse } from "node-html-parser";
import type { Request, Response } from "express";

// ─── URL Pattern Fallbacks ──────────────────────────────────────────

// ponytail: These are crude heuristics; could be replaced with a config-driven
// pattern registry if more sources are added.
const KNOWN_PATTERNS = [
  (base: string, num: string) => `${base.replace(/\/$/, "")}/chapter-${num}`,
  (base: string, num: string) => `${base.replace(/\/$/, "")}/${num}`,
  (base: string, num: string) => {
    const m = base.match(/(https?:\/\/[^/]+\/manga\/[^/]+)/);
    return m ? `${m[1]}/chapter-${num}` : null;
  },
];

// ─── HTML Scraping Helper ───────────────────────────────────────────

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

// ─── Handler ────────────────────────────────────────────────────────

export async function handlePages(req: Request, res: Response) {
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
