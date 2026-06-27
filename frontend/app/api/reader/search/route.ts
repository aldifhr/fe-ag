import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  const source = request.nextUrl.searchParams.get("source") || "all";

  if (!q?.trim()) {
    return NextResponse.json({ error: "Query parameter 'q' required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${API_BASE}/api/reader-search?q=${encodeURIComponent(q)}&source=${source}`, {
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
