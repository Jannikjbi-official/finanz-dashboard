import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { Wordmark } from "@/ui/logo";
import { buttonClass } from "@/ui/button";

const NAV = [
  { href: "/funktionen", label: "Funktionen" },
  { href: "/sicherheit", label: "Daten & Sicherheit" },
  { href: "/faq", label: "Fragen" },
];

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-8 px-5 sm:px-8">
          <Link href="/" aria-label={`${BRAND.name} – Startseite`}>
            <Wordmark />
          </Link>
          <nav aria-label="Hauptnavigation" className="hidden items-center gap-6 md:flex">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-[14px] text-ink-2 hover:text-ink">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/anmelden" className={buttonClass("ghost", "sm")}>
              Anmelden
            </Link>
            <Link href="/warteliste" className={buttonClass("primary", "sm")}>
              Warteliste
            </Link>
          </div>
        </div>
      </header>

      <main id="inhalt" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto grid max-w-[1120px] gap-8 px-5 py-10 sm:grid-cols-[1.5fr_1fr_1fr] sm:px-8">
          <div className="flex flex-col gap-3">
            <Wordmark size={20} />
            <p className="max-w-xs text-[13px] leading-relaxed text-ink-3">
              Kostenlose Finanzplanung für Privatpersonen. Keine Bankzugangsdaten, kein Tracking, keine Werbung. Keine Anlage- oder
              Finanzberatung.
            </p>
          </div>
          <nav aria-label="Produkt" className="flex flex-col gap-2 text-[13px]">
            <p className="font-medium text-ink">Produkt</p>
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-ink-2 hover:text-ink">
                {item.label}
              </Link>
            ))}
            <Link href="/warteliste" className="text-ink-2 hover:text-ink">
              Warteliste
            </Link>
          </nav>
          <nav aria-label="Rechtliches" className="flex flex-col gap-2 text-[13px]">
            <p className="font-medium text-ink">Rechtliches</p>
            <Link href="/impressum" className="text-ink-2 hover:text-ink">
              Impressum
            </Link>
            <Link href="/datenschutz" className="text-ink-2 hover:text-ink">
              Datenschutz
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
