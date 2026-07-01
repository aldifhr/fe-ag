import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, UI_COOKIE_NAME, COOKIE_MAX_AGE, computeAuthHash } from "@/lib/siteAuth";

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

    // Set auth_ui cookie so client knows login state
    if (body?.data?.authenticated) {
      response.cookies.set(UI_COOKIE_NAME, "1", {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: COOKIE_MAX_AGE,
      });
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

    // Logout: clear cookies, no backend call needed
    if (action === "logout") {
      const response = NextResponse.json({ success: true, data: { ok: true } });
      response.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
      response.cookies.set(UI_COOKIE_NAME, "", { path: "/", maxAge: 0 });
      return response;
    }

    const body = await request.json();
    const cookie = request.headers.get("cookie") || "";

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cookie) headers.cookie = cookie;

    const res = await fetch(`${API_BASE}/api/auth?action=${action}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json();
    const response = NextResponse.json(data, { status: res.status });

    // Forward Set-Cookie from backend so browser actually gets the session cookie
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      response.headers.set("set-cookie", setCookie);
    }

    // Also set site_auth cookie so middleware doesn't redirect back to /login
    if (data?.success) {
      const pw = process.env.SITE_PASSWORD;
      const secret = process.env.AUTH_SECRET;
      if (!pw || !secret) {
        console.warn("Missing SITE_PASSWORD or AUTH_SECRET, skipping site_auth cookie");
      } else {
        const hash = await computeAuthHash(pw, secret);
        response.cookies.set(COOKIE_NAME, hash, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: COOKIE_MAX_AGE,
        });
        response.cookies.set("auth_ui", "1", {
          httpOnly: false,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: COOKIE_MAX_AGE,
        });
      }
    }

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
