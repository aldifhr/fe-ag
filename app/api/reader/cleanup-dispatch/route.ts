import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000";
const TOKEN = "Bearer manhwascan";

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/api/cleanup-dispatch`, {
      headers: { Authorization: TOKEN },
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, error: `Upstream ${res.status}` }, { status: res.status });
    }

    const body = await res.json();
    return NextResponse.json(body);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
