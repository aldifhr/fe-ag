import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

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
    const wantWebp = accept.includes("image/webp");

    const upstream = await fetch(url.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!upstream.ok) {
      return new NextResponse("Upstream fetch failed", {
        status: upstream.status,
      });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const isConvertible =
      contentType.includes("image/jpeg") || contentType.includes("image/png");
    const alreadyWebp = contentType.includes("image/webp");

    if (wantWebp && isConvertible && !alreadyWebp) {
      // Convert to WebP
      const buffer = Buffer.from(await upstream.arrayBuffer());
      const webpBuffer = await sharp(buffer).webp({ quality: 85 }).toBuffer();
      return new NextResponse(new Uint8Array(webpBuffer), {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=31536000, immutable",
          Vary: "Accept",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Serve as-is (already WebP, or browser doesn't want WebP)
    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        Vary: "Accept",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new NextResponse("Proxy error", { status: 500 });
  }
}
