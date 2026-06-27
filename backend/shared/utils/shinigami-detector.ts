import { httpGet } from "../httpClient.js";
import { HTTP_USER_AGENT, SECONDARY_SOURCE_URL } from "../scrapers/shared.js";

const API_BASE = (SECONDARY_SOURCE_URL || "https://api.shngm.io").replace(/\/+$/, "");

const JSON_HEADERS = {
  Accept: "application/json",
  "User-Agent": HTTP_USER_AGENT,
};

export type ShinigamiSource = "project" | "mirror" | "both" | "none";

export interface SourceDetectionResult {
  mangaId: string;
  source: ShinigamiSource;
  title?: string;
  found: boolean;
  projectTitle?: string;
  mirrorTitle?: string;
  projectData?: unknown;
  mirrorData?: unknown;
}

export interface SourceDetectionOptions {
  timeout?: number;
  retries?: number;
}

export function extractShinigamiMangaId(input: string): string | null {
  const uuidMatch = input.match(/\/(?:series|manga|komik)\/([a-f0-9-]{36})/i);
  if (uuidMatch) return uuidMatch[1];

  const slugMatch = input.match(/\/(?:series|manga|komik)\/([^/?#]+)/i);
  if (slugMatch) return slugMatch[1];

  if (/^[a-f0-9-]{36}$/i.test(input)) return input;

  if (/^[a-z0-9-]+$/i.test(input)) return input;

  return null;
}

interface TypeItem {
  taxonomy_id: number;
  slug: string;
  name: string;
}

interface MangaDetailResponse {
  title?: string;
  name?: string;
  Type?: TypeItem[];
  taxonomy?: Record<string, TypeItem[]>;
  [key: string]: unknown;
}

function extractMangaDetail(data: unknown): MangaDetailResponse | null {
  const root = (data as Record<string, unknown>)?.data ?? (data as Record<string, unknown>)?.result ?? data;
  if (!root || typeof root !== "object") return null;
  return root as MangaDetailResponse;
}

function detectSourceFromTypes(
  types: TypeItem[] | undefined,
  taxonomy?: Record<string, TypeItem[]>
): { isProject: boolean; isMirror: boolean } {
  if (Array.isArray(types)) {
    const isProject = types.some(t => t.slug === "project" || t.name?.toLowerCase() === "project");
    const isMirror = types.some(t => t.slug === "mirror" || t.name?.toLowerCase() === "mirror");
    if (isProject || isMirror) return { isProject, isMirror };
  }

  if (taxonomy?.Type && Array.isArray(taxonomy.Type)) {
    const isProject = taxonomy.Type.some(t => t.slug === "project" || t.name?.toLowerCase() === "project");
    const isMirror = taxonomy.Type.some(t => t.slug === "mirror" || t.name?.toLowerCase() === "mirror");
    return { isProject, isMirror };
  }

  return { isProject: false, isMirror: false };
}

async function fetchMangaDetailAndDetect(
  mangaId: string,
  options: SourceDetectionOptions = {}
): Promise<{
  found: boolean;
  title?: string;
  source: ShinigamiSource;
  types?: TypeItem[];
  rawData?: unknown;
}> {
  const { timeout = 10000, retries = 2 } = options;

  try {
    const res = await httpGet(
      `${API_BASE}/v1/manga/detail/${mangaId}`,
      { headers: JSON_HEADERS, timeout },
      { retries, baseDelayMs: 500 }
    );

    const data = extractMangaDetail(res?.data);

    if (!data || (!data.title && !data.name)) {
      return { found: false, source: "none" };
    }

    const title = data.title || data.name;
    const resolvedTypes = data.Type || data.taxonomy?.Type || [];
    const { isProject, isMirror } = detectSourceFromTypes(data.Type, data.taxonomy);

    let source: ShinigamiSource;
    if (isProject && isMirror) source = "both";
    else if (isProject) source = "project";
    else if (isMirror) source = "mirror";
    else source = "none";

    return {
      found: true,
      title: String(title).trim(),
      source,
      types: resolvedTypes,
      rawData: data,
    };
  } catch {
    return { found: false, source: "none" };
  }
}

export async function detectSource(
  mangaId: string,
  options: SourceDetectionOptions = {}
): Promise<SourceDetectionResult> {
  const result = await fetchMangaDetailAndDetect(mangaId, options);

  if (!result.found) {
    return {
      mangaId,
      source: "none",
      found: false,
    };
  }

  const { isProject, isMirror } = detectSourceFromTypes(result.types, (result.rawData as MangaDetailResponse)?.taxonomy);

  let source: ShinigamiSource;
  if (isProject && isMirror) source = "both";
  else if (isProject) source = "project";
  else if (isMirror) source = "mirror";
  else source = "none";

  return {
    mangaId,
    source,
    found: true,
    title: result.title,
    projectTitle: isProject ? result.title : undefined,
    mirrorTitle: isMirror ? result.title : undefined,
    projectData: isProject ? result.rawData : undefined,
    mirrorData: isMirror ? result.rawData : undefined,
  };
}
