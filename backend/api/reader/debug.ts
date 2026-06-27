import { SECONDARY_SOURCE_URL } from "../../shared/scrapers/shared.js";
import { SECONDARY_CONFIG } from "../../reader/config.js";
import { fetchWithRetry, JSON_HEADERS } from "../../shared/scrapers/secondary/api.js";
import { isAxiosLikeResponse, isSecondaryApiData } from "../../shared/scrapers/secondary/types.js";
import type { Request, Response } from "express";

export default async function handler(req: Request, res: Response) {
  const mangaId = req.query.id as string || "1";
  const endpoint = `${SECONDARY_SOURCE_URL}/v1/manga/detail/${mangaId}`;

  try {
    const apiRes = await fetchWithRetry(endpoint, JSON_HEADERS, SECONDARY_CONFIG.REQUEST_TIMEOUT);

    if (!isAxiosLikeResponse(apiRes)) {
      return res.json({ error: "Not an Axios-like response", data: null });
    }

    const raw = isSecondaryApiData(apiRes.data) ? apiRes.data : {};
    const rawData = raw as Record<string, unknown>;
    const payload = rawData.data ?? raw;

    // Find chapters
    const chapterKeys = ["chapters", "latest_chapters", "chapter_list", "chapterList"];
    const foundChapters: Record<string, unknown> = {};

    for (const key of chapterKeys) {
      const val = (payload as Record<string, unknown>)[key];
      if (Array.isArray(val)) {
        foundChapters[key] = {
          count: val.length,
          first: val[0] ? Object.keys(val[0] as Record<string, unknown>) : null,
          sample: val[0] ? (val[0] as Record<string, unknown>) : null,
        };
      } else {
        foundChapters[key] = typeof val;
      }
    }

    // Also check raw (outer wrapper)
    for (const key of chapterKeys) {
      const val = (raw as Record<string, unknown>)[key];
      if (Array.isArray(val)) {
        foundChapters[`raw.${key}`] = {
          count: val.length,
          first: val[0] ? Object.keys(val[0] as Record<string, unknown>) : null,
        };
      } else {
        foundChapters[`raw.${key}`] = typeof val;
      }
    }

    // Also check nested data
    const nested = (raw as Record<string, unknown>).data as Record<string, unknown> | undefined;
    if (nested) {
      for (const key of chapterKeys) {
        const val = nested[key];
        if (Array.isArray(val)) {
          foundChapters[`nested.${key}`] = {
            count: val.length,
            first: val[0] ? Object.keys(val[0] as Record<string, unknown>) : null,
          };
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
