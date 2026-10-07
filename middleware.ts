import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Schneller Vorfilter: ohne Session-Cookie direkt zur Anmeldung. Die echte
 * Pruefung (gueltige Session, Nutzerbindung) passiert serverseitig in jeder
 * Seite und Action ueber requireUser().
 */
export function middleware(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  const url = new URL("/anmelden", request.url);
  url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/app/:path*", "/willkommen"],
};
