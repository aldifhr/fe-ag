import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000";

export async function GET(request: NextRequest) {
  try {
    const action = request.nextUrl.searchParams.get("action") || "status";
    const cookie = request.headers.get("cookie") || "";
    const headers: Record<string, string> = {};
    if (cookie) headers.cookie = cookie;

    const res = await fetch(`${API_BASE}/api/auth?action=${action}`, {
      headers,
      signal: AbortSignal.timeout(10000),
    });

    const body = await res.json();
    const response = NextResponse.json(body, { status: res.status });

    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      response.headers.set("set-cookie", setCookie);
    }

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const action = request.nextUrl.searchParams.get("action") || "login";
    const body = await request.json();

    const res = await fetch(`${API_BASE}/api/auth?action=${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json();
    const response = NextResponse.json(data, { status: res.status });

    // Forward Set-Cookie from backend so browser actually gets the session cookie
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      response.headers.set("set-cookie", setCookie);
    }

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
