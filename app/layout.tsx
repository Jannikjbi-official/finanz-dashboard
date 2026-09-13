import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finanzen",
  description: "Privates Dashboard für Einnahmen, Ausgaben und Abos",
};

export const viewport: Viewport = {
  themeColor: "#0b0d12",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className="dark">
      <body className="min-h-screen text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
