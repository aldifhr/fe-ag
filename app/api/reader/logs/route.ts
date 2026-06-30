import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000";
const TOKEN = "Bearer manhwascan";

export async function GET(request: NextRequest) {
  try {
    const cookie = request.headers.get("cookie") || "";
    const headers: Record<string, string> = { Authorization: TOKEN };
    if (cookie) headers.cookie = cookie;

    const res = await fetch(`${API_BASE}/api/logs?format=json`, {
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, error: `Upstream ${res.status}` }, { status: res.status });
    }

    const body = await res.json();
    return NextResponse.json(body);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message, data: [] }, { status: 500 });
  }
}
