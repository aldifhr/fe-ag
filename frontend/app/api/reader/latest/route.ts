import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000";

export async function GET(request: NextRequest) {
  const page = request.nextUrl.searchParams.get("page") || "1";
  const source = request.nextUrl.searchParams.get("source") || "all";
  const sort = request.nextUrl.searchParams.get("sort") || "latest";

  try {
    const res = await fetch(
      `${API_BASE}/api/reader?route=latest&page=${page}&source=${source}&sort=${sort}`,
      {
        signal: AbortSignal.timeout(15000),
      },
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
