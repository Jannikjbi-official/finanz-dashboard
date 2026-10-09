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
  ...(isProduction ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

/** Alte Adressen der frueheren Oberflaeche - Lesezeichen funktionieren weiter. */
const legacyRoutes = [
  ["/login", "/anmelden"],
  ["/transaktionen", "/app/geld/buchungen"],
  ["/konten", "/app/geld"],
  ["/abos", "/app/planung/fixkosten"],
  ["/budgets", "/app/planung/budgets"],
  ["/erstattungen", "/app/planung/geplant"],
  ["/auswertung", "/app/rueckblick/analysen"],
  ["/daten", "/app/einstellungen/daten"],
  ["/einstellungen", "/app/einstellungen"],
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["mongodb"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return legacyRoutes.map(([source, destination]) => ({ source, destination, permanent: true }));
  },
};

export default nextConfig;
