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
  // Alles ausser Anmeldung, Auth-API, Cron (eigene Pruefung per CRON_SECRET) und
  // oeffentlichen Dateien der App (Manifest, Service Worker, Icons, Offline-Seite)
  matcher: [
    "/((?!anmelden|registrieren|api/auth|api/cron|_next/static|_next/image|icon.svg|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/).*)",
  ],
};
