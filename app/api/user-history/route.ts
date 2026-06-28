import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000";

async function proxy(request: NextRequest, method: string, path: string, body?: string) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Not logged in" } },
      { status: 401 },
    );
  }

  try {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL", message } },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams.toString();
  return proxy(request, "GET", `/user-history${params ? `?${params}` : ""}`);
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  return proxy(request, "POST", "/user-history", body);
}

export async function DELETE(request: NextRequest) {
  return proxy(request, "DELETE", "/user-history");
}
