import { NextResponse } from "next/server";
import { computeAuthHash, COOKIE_NAME, COOKIE_MAX_AGE } from "@/lib/siteAuth";

export async function POST(request: Request) {
  const { password } = await request.json();

  if (password !== process.env.SITE_PASSWORD) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const hash = await computeAuthHash(password, process.env.AUTH_SECRET || "");

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, hash, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return response;
}
