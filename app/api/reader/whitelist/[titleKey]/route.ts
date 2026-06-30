import { NextRequest, NextResponse } from "next/server";

interface CatalogItem {
  title: string;
  titleKey: string;
  cover: string;
  sources: { source: string; url: string }[];
  metadata: {
    status: string;
    rating: string;
    genres: string[];
    description: string;
  };
  latestChapter: {
    number: number;
    url: string;
    sentAt: string;
    source: string;
  } | null;
}

interface CatalogDetailResponse {
  success: boolean;
  data: CatalogItem;
  error?: { code: string; message: string };
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ titleKey: string }> },
) {
  try {
    const { titleKey } = await params;

    if (!titleKey) {
      return NextResponse.json(
        { success: false, error: "titleKey is required" },
        { status: 400 },
      );
    }

    const res = await fetch(`${API_BASE}/api/catalog/${titleKey}`, {
      signal: AbortSignal.timeout(15000),
    });

    const body: CatalogDetailResponse = await res.json();

    if (!res.ok || !body.success) {
      return NextResponse.json(
        { success: false, error: body.error?.message || `HTTP ${res.status}` },
        { status: res.status },
      );
    }

    return NextResponse.json({ success: true, data: body.data }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
