import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get("src");
  if (!src) {
    return new NextResponse("Missing src parameter", { status: 400 });
  }

  try {
    const res = await fetch(src, {
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://www.google.com/",
        Accept: "image/webp,image/avif,image/*,*/*;q=0.8",
      },
    });

    if (!res.ok) {
      return new NextResponse(`Upstream ${res.status}`, { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "image/webp";
    const buffer = Buffer.from(await res.arrayBuffer());

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new NextResponse("Failed to fetch image", { status: 502 });
  }
}
