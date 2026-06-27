import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  const baseUrl = request.nextUrl.searchParams.get("baseUrl");
  const chapterNum = request.nextUrl.searchParams.get("chapter");

  if (!url && (!baseUrl || !chapterNum)) {
    return NextResponse.json({ error: "Need 'url' OR ('baseUrl' + 'chapter')" }, { status: 400 });
  }

  try {
    let apiUrl = `${API_BASE}/api/reader-pages?url=${encodeURIComponent(url || "")}`;
    if (baseUrl && chapterNum) {
      apiUrl += `&baseUrl=${encodeURIComponent(baseUrl)}&chapter=${encodeURIComponent(chapterNum)}`;
    }
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(20000) });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed: ${message}` }, { status: 500 });
  }
}
