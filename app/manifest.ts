import type { MetadataRoute } from "next";

/** Installierbar auf Handy und Computer ("Zum Startbildschirm" / "App installieren"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // Feste Kennung: bleibt dieselbe App, auch wenn sich start_url aendert
    id: "/",
    name: "Jannikjbi Finanzen",
    short_name: "Finanzen",
    description: "Private Finanzverwaltung",
    lang: "de",
    start_url: "/",
    scope: "/",
    display: "standalone",
    categories: ["finance", "productivity"],
    background_color: "#121514",
    theme_color: "#121514",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Langes Druecken auf das App-Symbol (Android, Windows, macOS)
    shortcuts: [
      { name: "Ausgabe erfassen", short_name: "Ausgabe", url: "/?erfassen=ausgabe", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Einnahme erfassen", short_name: "Einnahme", url: "/?erfassen=einnahme", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Transaktionen", url: "/transaktionen", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Kalender", url: "/kalender", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
