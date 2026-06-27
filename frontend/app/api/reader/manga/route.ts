import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const url = request.nextUrl.searchParams.get("url");
  const source = request.nextUrl.searchParams.get("source") || "shinigami";

  if (!id && !url) {
    return NextResponse.json({ error: "Query parameter 'id' or 'url' required" }, { status: 400 });
  }

  try {
    const params = source === "ikiru" && url ? `url=${encodeURIComponent(url)}` : `id=${encodeURIComponent(id || "")}`;
    const res = await fetch(`${API_BASE}/api/reader?route=manga&source=${source}&${params}`, {
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
