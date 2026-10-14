import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import { ServiceWorker } from "@/components/shell/service-worker";
import "./globals.css";

const sans = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-schibsted",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Jannikjbi Finanzen", template: "%s · Jannikjbi Finanzen" },
  description: "Private Finanzverwaltung",
  robots: { index: false, follow: false },
  applicationName: "Finanzen",
  appleWebApp: { capable: true, title: "Finanzen", statusBarStyle: "black" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  // Fuer die Safe-Area unten (Home-Leiste) in der installierten App
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#121514" },
    { media: "(prefers-color-scheme: light)", color: "#f7f7f4" },
  ],
};

/**
 * Dunkel ist Standard. Wer hell oder "System" gewaehlt hat, bekommt es vor
 * dem ersten Zeichnen, damit nichts aufblitzt.
 */
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="system")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";if(t==="light"){var d=document.documentElement;d.classList.remove("dark");d.classList.add("light");d.dataset.theme="light"}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${sans.variable} dark`} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
