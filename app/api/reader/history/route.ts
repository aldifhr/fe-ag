import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000";
const TOKEN = "Bearer manhwascan";

export async function GET(request: NextRequest) {
  const endpoint = request.nextUrl.searchParams.get("endpoint") || "recent";

  try {
    const res = await fetch(`${API_BASE}/api/history?endpoint=${endpoint}`, {
      headers: { Authorization: TOKEN },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream ${res.status}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message, items: [] }, { status: 500 });
  }
}
