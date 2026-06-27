import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const genre = searchParams.get("genre");
  const page = searchParams.get("page") || "1";
  if (!genre) {
    return NextResponse.json({ error: "Missing genre param" }, { status: 400 });
  }
  try {
    const res = await fetch(
      `${API_BASE}/api/reader?route=genre-manga&genre=${encodeURIComponent(genre)}&page=${page}&page_size=20`,
      { signal: AbortSignal.timeout(15000) },
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
