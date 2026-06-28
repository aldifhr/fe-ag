import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

// --- In-memory LRU cache ---
interface CacheEntry {
  buffer: Buffer;
  contentType: string;
  timestamp: number;
}

const IMAGE_CACHE = new Map<string, CacheEntry>();
const CACHE_MAX = 50;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const TRANSPARENT_GIF_BUFFER = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);
const TRANSPARENT_GIF_TYPE = "image/gif";

function getFromCache(key: string): CacheEntry | undefined {
  const entry = IMAGE_CACHE.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    IMAGE_CACHE.delete(key);
    return undefined;
  }
  // LRU: move to end (most recently used)
  IMAGE_CACHE.delete(key);
  IMAGE_CACHE.set(key, entry);
  return entry;
}

function setCache(key: string, entry: CacheEntry): void {
  // Evict oldest entry if at capacity
  if (IMAGE_CACHE.size >= CACHE_MAX) {
    const oldestKey = IMAGE_CACHE.keys().next().value;
    if (oldestKey !== undefined) IMAGE_CACHE.delete(oldestKey);
  }
  IMAGE_CACHE.set(key, entry);
}

function buildResponse(
  buffer: BodyInit,
  contentType: string
): NextResponse {
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      Vary: "Accept",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function isPrivateHost(hostname: string): boolean {
  if (BLOCKED_HOSTS.has(hostname)) return true;
  if (
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("172.")
  )
    return true;
  return false;
}

export const runtime = "nodejs"; // Force Node.js runtime for sharp

export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get("src");
  if (!src) return new NextResponse("Missing src", { status: 400 });

  try {
    const url = new URL(src);
    if (!["http:", "https:"].includes(url.protocol)) {
      return new NextResponse("Invalid protocol", { status: 400 });
    }
    if (isPrivateHost(url.hostname)) {
      return new NextResponse("Blocked host", { status: 403 });
    }

    const accept = req.headers.get("accept") || "";
    const wantAvif = accept.includes("image/avif");
    const wantWebp = accept.includes("image/webp");
    // Determine format key for cache: avif > webp > original
    const formatKey = wantAvif ? "avif" : wantWebp ? "webp" : "original";
    const cacheKey = `${src}:${formatKey}`;

    // Check in-memory LRU cache
    const cached = getFromCache(cacheKey);
    if (cached) {
      return buildResponse(cached.buffer as unknown as BodyInit, cached.contentType);
    }

    const upstream = await fetch(url.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept:
          "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!upstream.ok) {
      // Graceful fallback: return 1x1 transparent GIF instead of broken image icon
      return buildResponse(TRANSPARENT_GIF_BUFFER as unknown as BodyInit, TRANSPARENT_GIF_TYPE);
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const isConvertible =
      contentType.includes("image/jpeg") || contentType.includes("image/png");
    const alreadyWebp = contentType.includes("image/webp");
    const alreadyAvif = contentType.includes("image/avif");

    const buffer = Buffer.from(await upstream.arrayBuffer());
    let resultBuffer: Buffer;
    let resultContentType: string;

    if (wantAvif && isConvertible && !alreadyAvif) {
      // Convert JPEG/PNG to AVIF (~30% smaller than WebP at same quality)
      resultBuffer = await sharp(buffer).avif({ quality: 85 }).toBuffer();
      resultContentType = "image/avif";
    } else if (wantWebp && isConvertible && !alreadyWebp && !alreadyAvif) {
      resultBuffer = await sharp(buffer).webp({ quality: 85 }).toBuffer();
      resultContentType = "image/webp";
    } else {
      // Serve as-is (already AVIF/WebP, non-convertible format, or client prefers original)
      resultBuffer = buffer;
      resultContentType = contentType;
    }

    // Populate in-memory LRU cache
    setCache(cacheKey, {
      buffer: resultBuffer,
      contentType: resultContentType,
      timestamp: Date.now(),
    });

    return buildResponse(resultBuffer as unknown as BodyInit, resultContentType);
  } catch {
    // Graceful fallback for timeouts, network errors, sharp failures, etc.
    return buildResponse(TRANSPARENT_GIF_BUFFER as unknown as BodyInit, TRANSPARENT_GIF_TYPE);
  }
}
