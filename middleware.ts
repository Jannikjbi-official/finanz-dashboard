import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Schneller Vorfilter: ohne Session-Cookie zur Anmeldung ("/" zeigt dann die
 * oeffentliche Startseite). Die echte
 * Pruefung (gueltige Session, Nutzerbindung) passiert serverseitig in jeder
 * Seite und jeder Server Action.
 */
export function middleware(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  // Ohne Anmeldung zeigt "/" die oeffentliche Startseite - ausser bei einer
  // App-Verknuepfung ("/?erfassen=ausgabe"): dann anmelden und weiter dorthin
  if (request.nextUrl.pathname === "/" && !request.nextUrl.searchParams.has("erfassen")) {
    return NextResponse.rewrite(new URL("/start", request.url));
  }

  const url = new URL("/anmelden", request.url);
  url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  // Alles ausser Anmeldung, oeffentlichen Seiten (Startseite, Impressum, Datenschutz),
  // Auth-API, Cron (eigene Pruefung per CRON_SECRET) und oeffentlichen Dateien der
  // App (Manifest, Service Worker, Icons, Offline-Seite)
  matcher: [
    "/((?!anmelden|registrieren|start|impressum|datenschutz|api/auth|api/cron|_next/static|_next/image|icon.svg|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/).*)",
  ],
};
