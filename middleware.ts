import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, computeAuthHash } from "@/lib/siteAuth";

const PUBLIC_PATHS = ["/login", "/api/auth", "/api/reader/auth"];

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(COOKIE_NAME)?.value;

  if (!cookie) {
    return redirectToLogin(request);
  }

  const pw = process.env.SITE_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!pw || !secret) {
    return redirectToLogin(request);
  }

  const expectedHash = await computeAuthHash(pw, secret);

  if (cookie !== expectedHash) {
    return redirectToLogin(request);
  }

  return NextResponse.next();
}

function redirectToLogin(request: NextRequest) {
  // kalau ini request API, jangan redirect, balikin 401
  if (request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};