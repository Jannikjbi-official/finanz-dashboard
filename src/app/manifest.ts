import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Finanzen",
    short_name: "Finanzen",
    description: "Private Finanz-App: Ausgaben, Einnahmen, Abos und Wunschliste.",
    lang: "de-DE",
    dir: "ltr",
    start_url: "/?quelle=app",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    orientation: "portrait",
    background_color: "#0b0c12",
    theme_color: "#0b0c12",
    categories: ["finance", "productivity"],
    prefer_related_applications: false,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      {
        name: "Ausgabe hinzufügen",
        short_name: "Ausgabe",
        url: "/ausgaben?neu=1",
        icons: [{ src: "/icons/shortcut-add.png", sizes: "96x96", type: "image/png" }],
      },
      {
        name: "Abos",
        url: "/abos",
        icons: [{ src: "/icons/shortcut-abos.png", sizes: "96x96", type: "image/png" }],
      },
      {
        name: "Wunschliste",
        url: "/wunschliste",
        icons: [{ src: "/icons/shortcut-wishlist.png", sizes: "96x96", type: "image/png" }],
      },
    ],
  };
}
