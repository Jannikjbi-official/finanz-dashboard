import type { MetadataRoute } from "next";

/** Installierbar auf dem Handy ("Zum Startbildschirm"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jannikjbi Finanzen",
    short_name: "Finanzen",
    description: "Private Finanzverwaltung",
    lang: "de",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#121514",
    theme_color: "#121514",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
