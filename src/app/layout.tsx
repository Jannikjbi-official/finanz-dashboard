import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/providers/app-providers";
import { themeInitScript } from "@/components/providers/theme-provider";
import "./globals.css";

// [Pixelbreite, Pixelhöhe, CSS-Breite, CSS-Höhe, Pixeldichte] – siehe scripts/generate-icons.ts
const SPLASH = [
  [1320, 2868, 440, 956, 3],
  [1206, 2622, 402, 874, 3],
  [1290, 2796, 430, 932, 3],
  [1179, 2556, 393, 852, 3],
  [1284, 2778, 428, 926, 3],
  [1170, 2532, 390, 844, 3],
  [1125, 2436, 375, 812, 3],
  [1242, 2688, 414, 896, 3],
  [828, 1792, 414, 896, 2],
  [750, 1334, 375, 667, 2],
  [1640, 2360, 820, 1180, 2],
  [2048, 2732, 1024, 1366, 2],
] as const;

export const metadata: Metadata = {
  title: { default: "Finanzen", template: "%s · Finanzen" },
  description: "Private Finanz-App",
  applicationName: "Finanzen",
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  appleWebApp: {
    capable: true,
    title: "Finanzen",
    statusBarStyle: "black-translucent",
    startupImage: SPLASH.map(([w, h, dw, dh, r]) => ({
      url: `/icons/splash/splash-${w}x${h}.png`,
      media: `(device-width: ${dw}px) and (device-height: ${dh}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
    })),
  },
  formatDetection: { telephone: false, email: false, address: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0c12" },
    { media: "(prefers-color-scheme: light)", color: "#f7f8fb" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" className="dark" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line react/no-danger */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh bg-background font-sans text-foreground">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
