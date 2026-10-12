import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Schneller Vorfilter: ohne Session-Cookie direkt zur Anmeldung. Die echte
 * Pruefung (gueltige Session, Nutzerbindung) passiert serverseitig in jeder
 * Seite und jeder Server Action.
 */
export function middleware(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  const url = new URL("/anmelden", request.url);
  if (request.nextUrl.pathname !== "/") url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Alles ausser Anmeldung, Auth-API und statischen Dateien
  matcher: ["/((?!anmelden|registrieren|api/auth|_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
