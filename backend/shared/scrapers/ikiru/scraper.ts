/**
 * Node.js HTML scraper for Ikiru using cheerio.
 * Replaces the Python Scrapling bridge (blocked by Vercel Deployment Protection).
 */
import * as cheerio from "cheerio";
import { env } from "../../config/env.js";
import { getLogger } from "../../logger.js";

const logger = getLogger({ scope: "ikiru:cheerio" });

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const TIMEOUT_MS = 30_000;

// --- Types ---

export interface IkiruChapterItem {
  title: string;
  chapter: string;
  url: string;
  mangaUrl: string;
  source: "ikiru";
  updatedTime: string;
  cover: string;
  rating: string | null;
  status: string;
  genres: string[];
  description: string;
}

export interface IkiruMetadata {
  title: string;
  cover: string;
  rating: string;
  status: string;
  description: string;
  genres: string[];
}

// --- Helpers ---

function getBaseUrl(baseUrl?: string): string {
  const raw = baseUrl || env.IKIRU_BASE_URL || "https://03.ikiru.wtf";
  const m = raw.match(/(https?:\/\/[^/]+)/);
  return (m ? m[1] : raw).replace(/\/+$/, "") + "/";
}

function normalizeIkiruDomain(url: string): string {
  // Normalize any ikiru domain (06/05/03) to env.IKIRU_BASE_URL for consistency
  const target = getBaseUrl().replace(/\/$/, "");
  return url.replace(/https?:\/\/\d+\.ikiru\.wtf/g, target);
}

function toAbsoluteUrl(url: string, baseUrl: string): string {
  if (!url) return "";
  url = url.trim();
  if (url.startsWith("//")) return normalizeIkiruDomain(`https:${url}`);
  if (url.startsWith("/")) return `${getBaseUrl(baseUrl).replace(/\/$/, "")}${url}`;
  if (url.startsWith("http")) return normalizeIkiruDomain(url);
  return `${getBaseUrl(baseUrl)}${url}`;
}

function normalizeText(text: unknown): string {
  if (!text) return "";
  let val = String(text).replace(/<[^>]+>/g, "");

  // De-spacing: obfuscated text like "B e c o m i n g"
  if (val.length > 3) {
    const spaces = (val.match(/ /g) || []).length;
    if (spaces > val.length / 3) {
      // Protect word boundaries (2+ spaces) then remove single spaces
      val = val.replace(/\s{2,}/g, "\0").replace(/ /g, "").replace(/\0/g, " ");
    }
  }

  return val.split(/\s+/).join(" ").trim();
}

function normalizeStatus(status: unknown): string {
  const s = normalizeText(status).toLowerCase();
  if (["ongoing", "berjalan", "on-going", "publishing", "active", "rutin"].some((x) => s.includes(x)))
    return "Ongoing";
  if (["completed", "selesai", "tamat", "finish", "end", "tuntas"].some((x) => s.includes(x)))
    return "Completed";
  if (["hiatus", "drop", "pending", "break", "istirahat"].some((x) => s.includes(x))) return "Hiatus";
  return "Ongoing"; // Default
}

/** Extract a time string like "5 min ago" or "2 jam lalu" from text */
function extractRelativeTime(text: string): string {
  const m = text.match(/(\d+\s+(?:min(?:ute)?|hour|day|week|month|hour|menit|jam|hari|detik)[^\n]*)/i);
  return m ? m[1].trim() : "";
}

// --- HTTP ---

async function fetchPage(url: string, referer?: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": CHROME_UA,
        "Referer": referer || getBaseUrl(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.warn({ url, status: res.status }, "fetchPage non-200");
      return null;
    }
    return await res.text();
  } catch (err) {
    logger.error({ url, err: String(err) }, "fetchPage failed");
    return null;
  }
}

// --- Public API ---

/**
 * Scrape Ikiru latest-update pages.
 * Mirrors Python IkiruScraper.fetch_latest()
 */
export async function fetchIkiruLatest(maxPages = 1): Promise<IkiruChapterItem[]> {
  const baseUrl = getBaseUrl();
  const results: IkiruChapterItem[] = [];
  const seenKeys = new Set<string>();

  for (let p = 1; p <= maxPages; p++) {
    const url = p === 1 ? `${baseUrl}latest-update/` : `${baseUrl}latest-update/?the_page=${p}`;
    const html = await fetchPage(url, baseUrl);
    if (!html) break;

    const $ = cheerio.load(html);

    // Find all manga links
    $('a[href*="/manga/"]').each((_i, el) => {
      const $link = $(el);
      const href = $link.attr("href") || "";
      const mangaUrl = toAbsoluteUrl(href, baseUrl);

      // Skip chapter links
      if (!mangaUrl || mangaUrl.includes("/chapter-")) return;

      let title = normalizeText($link.text());
      if (!title) title = normalizeText($link.find("img").attr("alt"));
      if (!title) return;

      // Traverse up to find container with chapter links (max 3 levels)
       
      let $container: any = null;
      let $current = $link.parent();
      for (let depth = 0; depth < 3; depth++) {
        const chaps = $current.find('a.link-self, a[href*="/chapter-"]');
        if (chaps.length > 0) {
          $container = $current;
          break;
        }
        $current = $current.parent();
        if ($current.length === 0) break;
      }

      if (!$container) return;

      // Cover
      const img = $container.find("img").attr("src") || $container.find("img").attr("data-src") || "";

      // Status from text or badge colors
      let statusRaw: string | null = null;
      $container
        .find("*")
        .each((_j: number, el: any) => {
          const txt = $(el).text();
          if (/(Ongoing|Completed|Tamat|Hiatus)/i.test(txt)) {
            statusRaw = txt;
            return false; // break
          }
          return true;
        });
      if (!statusRaw) {
        if ($container.find('span.bg-green-600, span.bg-green-500, .bg-green-500').length) statusRaw = "Ongoing";
        else if ($container.find('span.bg-yellow-500, span.bg-yellow-400, .bg-yellow-500').length) statusRaw = "Hiatus";
        else if ($container.find('span.bg-red-500, span.bg-gray-500, .bg-red-500').length) statusRaw = "Completed";
      }
      const status = normalizeStatus(statusRaw);

      // Rating
      const ratingRaw =
        $container.find("div.numscore").text().trim() ||
        $container.find(".numscore").text().trim() ||
        $container.find("span.font-bold").text().trim();
      const rating = normalizeText(ratingRaw) || "N/A";

      // Chapters
      $container.find('a.link-self, a[href*="/chapter-"]').each((_ci: number, chapEl: any) => {
        const $chap = $(chapEl);
        const cHref = $chap.attr("href") || "";
        const cUrl = toAbsoluteUrl(cHref, baseUrl);
        if (!cUrl || !cUrl.includes("/chapter-")) return;

        const cTextRaw = $chap.text();
        const cTextMatch = cTextRaw.match(/Chapter\s+\d+(\.\d+)?/i);
        const cText = cTextMatch ? cTextMatch[0] : normalizeText(cTextRaw).split(" ")[0];
        if (!cText) return;

        // Time: first from the <a> tag itself, then from parent
        let cTime = extractRelativeTime(cTextRaw);
        if (!cTime) {
          const parentText = $chap.parent().text();
          cTime = extractRelativeTime(parentText);
        }

        const key = `${title}-${cText}`;
        if (seenKeys.has(key)) return;
        seenKeys.add(key);

        results.push({
          title,
          chapter: cText,
          url: cUrl,
          mangaUrl,
          source: "ikiru",
          updatedTime: cTime,
          cover: toAbsoluteUrl(img, baseUrl),
          rating,
          status,
          genres: [],
          description: "",
        });
      });
    });
  }

  logger.info({ count: results.length, maxPages }, "fetchIkiruLatest done");
  return results;
}

/**
 * Scrape a single Ikiru manga page for chapters + metadata.
 * Mirrors Python IkiruScraper.fetch_manga_details()
 */
export async function fetchIkiruMangaDetail(
  mangaUrl: string,
  skipMeta = false,
): Promise<{ chapters: IkiruChapterItem[]; metadata: IkiruMetadata }> {
  const baseUrl = getBaseUrl();
  const html = await fetchPage(mangaUrl, baseUrl);
  if (!html) return { chapters: [], metadata: emptyMetadata() };

  const $ = cheerio.load(html);

  // Title
  const title =
    normalizeText($("h1").first().text()) ||
    normalizeText($("[itemprop='name']").text()) ||
    normalizeText($(".manga-title").text()) ||
    normalizeText($("h1.entry-title").text()) ||
    normalizeText($("div.post-title h1").text());

  // Manga ID from page HTML (for AJAX chapter list)
  const mangaIdMatch = html.match(/manga_id=(\d+)/);
  const mangaId = mangaIdMatch ? mangaIdMatch[1] : null;

  // --- Metadata ---
  const meta: IkiruMetadata = skipMeta ? { title, cover: "", rating: "N/A", status: "Ongoing", description: "", genres: [] } : (() => {
    // Rating
    const ratingRaw =
      $("div.numscore").text().trim() ||
      $(".font-bold.text-2xl").text().trim() ||
      $("div.rating-value").text().trim();

    let rating = normalizeText(ratingRaw);
    const isNumeric = /\d/.test(rating);
    if (rating && isNumeric && rating.toLowerCase() !== title.toLowerCase()) {
      const numMatch = rating.match(/(\d+(?:\.\d+)?)/);
      rating = numMatch ? numMatch[1] : "N/A";
    } else {
      rating = "N/A";
    }

    // Status
    let statusRaw: string | null = null;
    // Try label+value pattern
    $("[class*='flex']").each((_i, el) => {
      const txt = $(el).text();
      if (/Status/i.test(txt)) {
        statusRaw = txt.replace(/.*Status[:\s]*/i, "").trim().split("\n")[0].trim();
      }
    });

    if (!statusRaw) {
      // Badge colors
      const badges = $('span.bg-green-600, span.bg-green-500, span.bg-yellow-500, span.bg-red-500, .bg-green-500, .bg-yellow-500, .bg-red-500');
      badges.each((_i, el) => {
        const txt = normalizeText($(el).text()).toLowerCase();
        if (["ongoing", "berjalan", "completed", "selesai", "tamat", "hiatus", "drop"].some((x) => txt.includes(x))) {
          statusRaw = normalizeText($(el).text());
          return false;
        }
        return true;
      });
    }

    if (!statusRaw) {
      // Info containers
      $("div.flex.flex-col span, div.flex.flex-col div, .post-content_item").each((_i, el) => {
        const ltxt = normalizeText($(el).text()).toLowerCase();
        if (ltxt.includes("ongoing") || ltxt.includes("berjalan")) { statusRaw = "Ongoing"; return false; }
        if (ltxt.includes("completed") || ltxt.includes("tamat")) { statusRaw = "Completed"; return false; }
        if (ltxt.includes("hiatus")) { statusRaw = "Hiatus"; return false; }
        return true;
      });
    }

    // Genres
    let genres = $('a[href*="/genre/"], a[href*="/manga-genre/"], .manga-genres a, .genres-content a')
      .map((_i, el) => normalizeText($(el).text()))
      .get()
      .filter(Boolean);
    if (!genres.length) {
      genres = $('span.bg-secondary\\/30 a, div.bg-secondary\\/30 a')
        .map((_i, el) => normalizeText($(el).text()))
        .get()
        .filter(Boolean);
    }

    // Description
    const descSelectors = [
      "div.bg-primary-bg.shadow-inner.p-4.text-sm",
      "div.mb-4.text-sm.leading-relaxed.text-gray-400",
      "div.mb-4.text-sm.leading-relaxed",
      "div.entry-content p",
      "div.summary-content p",
      "div.post-content_item p",
      "div.description-summary p",
      "div.manga-summary p",
      "[itemprop='description'][data-show='true']",
      "[itemprop='description']",
      "div.p-4.rounded-xl.bg-background-200\\/50 p",
      "div.p-4.rounded-xl.bg-background-200\\/50",
      "div.summary-content",
      "div#summary",
      "div.post-content_item",
      "meta[property='og:description']",
      "meta[name='description']",
    ];

    let description = "";
    for (const sel of descSelectors) {
      const els = $(sel);
      if (!els.length) continue;
      const val = normalizeText(els.text() || els.attr("content") || "");
      if (val && val.length > 15) {
        description = val;
        break;
      }
    }

    // Cover
    const cover =
      $("img.wp-post-image").attr("src") ||
      $("img[itemprop='image']").attr("src") ||
      "";

    return {
      title,
      cover: toAbsoluteUrl(cover, baseUrl),
      rating,
      status: normalizeStatus(statusRaw),
      description,
      genres,
    };
  })();

  // --- Chapters ---
  const chapters: IkiruChapterItem[] = [];

  // Try AJAX endpoint first
  if (mangaId) {
    const ajaxUrl = `${baseUrl}wp-admin/admin-ajax.php?manga_id=${mangaId}&action=chapter_list`;
    const ajaxHtml = await fetchPage(ajaxUrl, mangaUrl);
    if (ajaxHtml) {
      const $ajax = cheerio.load(ajaxHtml);
      $ajax('a[href*="/chapter-"]').each((_i, el) => {
        const $a = $ajax(el);
        const cUrl = toAbsoluteUrl($a.attr("href") || "", baseUrl);
        const cTextRaw = $a.text();
        const cTextMatch = cTextRaw.match(/Chapter\s+\d+(\.\d+)?/i);
        const cText = cTextMatch ? cTextMatch[0] : normalizeText(cTextRaw).split(" ")[0];
        if (cUrl && cText) {
          chapters.push({
            title,
            chapter: cText,
            url: cUrl,
            mangaUrl,
            source: "ikiru",
            updatedTime: "",
            cover: meta.cover,
            rating: meta.rating,
            status: meta.status,
            genres: meta.genres,
            description: meta.description,
          });
        }
      });
    }
  }

  // Fallback: chapters from page links
  if (!chapters.length) {
    $('a[href*="/chapter-"]').each((_i, el) => {
      const $a = $(el);
      const cUrl = toAbsoluteUrl($a.attr("href") || "", baseUrl);
      const cText = normalizeText($a.text());
      if (cUrl && cText) {
        chapters.push({
          title,
          chapter: cText,
          url: cUrl,
          mangaUrl,
          source: "ikiru",
          updatedTime: "",
          cover: meta.cover,
          rating: meta.rating,
          status: meta.status,
          genres: meta.genres,
          description: meta.description,
        });
      }
    });
  }

  logger.info({ mangaUrl, chapters: chapters.length, title }, "fetchIkiruMangaDetail done");
  return { chapters, metadata: meta };
}

function emptyMetadata(): IkiruMetadata {
  return { title: "", cover: "", rating: "N/A", status: "Ongoing", description: "", genres: [] };
}
