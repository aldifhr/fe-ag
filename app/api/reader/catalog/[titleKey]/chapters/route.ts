import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ titleKey: string }> },
) {
  try {
    const { titleKey } = await params;
    if (!titleKey) {
      return NextResponse.json({ success: false, error: "titleKey is required" }, { status: 400 });
    }

    const res = await fetch(`${API_BASE}/api/catalog/${titleKey}/chapters`, {
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `Upstream ${res.status}` },
        { status: res.status },
      );
    }

    const body = await res.json();
    return NextResponse.json(body);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message, data: [] }, { status: 500 });
  }
}
