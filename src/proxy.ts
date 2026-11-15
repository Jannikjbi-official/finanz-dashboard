import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Optimistischer Schutz aller Seiten und API-Routen: ohne Session-Cookie →
 * Login (bzw. 401 für API). Die eigentliche Prüfung der Session passiert
 * zusätzlich in jedem Layout, jeder Server Action und jeder API-Route.
 */
const PUBLIC_PATHS = [
  "/login",
  "/kein-zugriff",
  "/offline",
  "/api/auth", // Discord-OAuth inkl. Callback, Notfall-Login, Login-Übergabe
  "/manifest.webmanifest",
  "/sw.js",
  "/icons",
  "/robots.txt",
  "/favicon.ico",
  "/apple-touch-icon.png",
];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const hasSession = !!getSessionCookie(request, { cookiePrefix: "finanzen" });
  if (hasSession) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (pathname !== "/") url.searchParams.set("weiter", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
