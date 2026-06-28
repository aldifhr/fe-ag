import { NextResponse } from "next/server";
import { computeAuthHash, COOKIE_NAME, COOKIE_MAX_AGE } from "@/lib/siteAuth";

export async function POST(request: Request) {
  const { password } = await request.json();

  if (password !== process.env.SITE_PASSWORD) {
    return NextResponse.json({ error: "Password salah" }, { status: 401 });
  }

  const hash = await computeAuthHash(password, process.env.AUTH_SECRET || "");

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, hash, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    secure: false, // local dev; set true in production
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return response;
}
