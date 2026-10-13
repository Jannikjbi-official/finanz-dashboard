const isProduction = process.env.NODE_ENV === "production";

/**
 * Content Security Policy: nur eigene Quellen. Next.js braucht Inline-Skripte
 * fuer die Hydrierung; im Entwicklungsmodus zusaetzlich eval fuer Fast Refresh.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://discord.com",
  "object-src 'none'",
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Private Anwendung: nicht in Suchmaschinen
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  ...(isProduction ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

/**
 * Adressen frueherer Versionen.
 *
 * Achtung: Die Vorversion hat /transaktionen, /konten, /einstellungen und
 * /abos PERMANENT (308) auf /app/... umgeleitet. Browser speichern solche
 * Umleitungen. Wuerden wir diese /app-Ziele jetzt zurueckleiten, entstuende
 * eine Endlosschleife. Deshalb werden sie intern umgeschrieben (rewrite),
 * nicht umgeleitet.
 */
const legacyRewrites = [
  ["/app/geld/buchungen", "/transaktionen"],
  ["/app/geld", "/konten"],
  ["/app/einstellungen", "/einstellungen"],
  ["/app/einstellungen/:path*", "/einstellungen"],
  ["/app/planung/fixkosten", "/feste-kosten"],
];

const legacyRedirects = [
  ["/login", "/anmelden"],
  ["/app", "/"],
  ["/app/geld/import", "/transaktionen"],
  ["/app/planung", "/feste-kosten"],
  ["/app/planung/geplant", "/transaktionen"],
  ["/app/planung/budgets", "/"],
  ["/app/planung/ziele", "/wuensche"],
  ["/app/entscheiden/:path*", "/"],
  ["/app/rueckblick/:path*", "/"],
  ["/abos", "/abonnements"],
  ["/budgets", "/"],
  ["/erstattungen", "/transaktionen"],
  ["/auswertung", "/"],
  ["/daten", "/einstellungen"],
  ["/willkommen", "/"],
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["mongodb"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return legacyRedirects.map(([source, destination]) => ({ source, destination, permanent: false }));
  },
  async rewrites() {
    return legacyRewrites.map(([source, destination]) => ({ source, destination }));
  },
};

export default nextConfig;
