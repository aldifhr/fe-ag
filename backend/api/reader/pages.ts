import { parse } from "node-html-parser";
import axios from "axios";
import type { Request, Response } from "express";

const KNOWN_PATTERNS = [
  (base: string, num: string) => `${base.replace(/\/$/, "")}/chapter-${num}`,
  (base: string, num: string) => `${base.replace(/\/$/, "")}/${num}`,
  (base: string, num: string) => {
    const m = base.match(/(https?:\/\/[^/]+\/manga\/[^/]+)/);
    return m ? `${m[1]}/chapter-${num}` : null;
  },
];

async function tryFetchPages(url: string): Promise<string[]> {
  const { data: html } = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Referer": new URL(url).origin,
    },
    timeout: 15000,
  });

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

export default async function handler(req: Request, res: Response) {
  const url = req.query.url as string;
  const baseUrl = req.query.baseUrl as string;
  const chapterNum = req.query.chapter as string;

  if (!url && (!baseUrl || !chapterNum)) {
    return res.status(400).json({ error: "Need 'url' OR ('baseUrl' + 'chapter')" });
  }

  try {
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: `Failed: ${message}` });
  }
}
