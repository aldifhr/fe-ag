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

interface CatalogData {
  results: CatalogItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface CatalogResponse {
  success: boolean;
  data: CatalogData;
  error?: { code: string; message: string };
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000";
const TOKEN = "Bearer manhwascan";

export async function GET(request: NextRequest) {
  const page = request.nextUrl.searchParams.get("page") || "1";
  const pageSize = request.nextUrl.searchParams.get("page_size") || "50";
  const search = request.nextUrl.searchParams.get("search") || "";

  try {
    const params = new URLSearchParams({ page, page_size: pageSize });
    if (search) params.set("search", search);

    const res = await fetch(`${API_BASE}/api/catalog?${params}`, {
      headers: { Authorization: TOKEN },
      signal: AbortSignal.timeout(15000),
    });

    const body: CatalogResponse = await res.json();

    if (!res.ok || !body.success) {
      return NextResponse.json(
        { error: body.error?.message || `HTTP ${res.status}` },
        { status: res.status },
      );
    }

    const catalogData = body.data;
    const items = catalogData?.results ?? [];

    // Map catalog items to SearchResult format for frontend consistency
    const results = items.map((item: CatalogItem) => {
      const source = item.sources?.[0]?.source || item.latestChapter?.source || "shinigami";
      const url = item.latestChapter?.url || item.sources?.[0]?.url || "";

      return {
        id: item.titleKey,
        title: item.title,
        cover: item.cover || null,
        source,
        url,
        country: "KR",
        description: item.metadata?.description ?? null,
        status: item.metadata?.status ?? null,
        rating: item.metadata?.rating ?? null,
        chapter: item.latestChapter ? String(item.latestChapter.number) : undefined,
        time: item.latestChapter?.sentAt ?? null,
        chapters: item.latestChapter
          ? [{ number: String(item.latestChapter.number), time: item.latestChapter.sentAt ?? null }]
          : [],
      };
    });

    return NextResponse.json({
      results,
      total: catalogData?.total ?? results.length,
      page: catalogData?.page ?? Number(page),
      pageSize: catalogData?.pageSize ?? Number(pageSize),
      totalPages: catalogData?.totalPages ?? 1,
    }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message, results: [], total: 0, page: 1, pageSize: 0, totalPages: 0 }, { status: 500 });
  }
}

/**
 * POST /api/reader/whitelist — Add new whitelist entry
 * Body: { title: string, url?: string, source?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${API_BASE}/api/whitelist`, {
      method: "POST",
      headers: { Authorization: TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/reader/whitelist — Remove whitelist entry
 * Body: { title: string, source?: string, url?: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${API_BASE}/api/whitelist`, {
      method: "DELETE",
      headers: { Authorization: TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/reader/whitelist — Mark whitelist entry
 * Body: { title: string, mark: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${API_BASE}/api/whitelist`, {
      method: "PATCH",
      headers: { Authorization: TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
