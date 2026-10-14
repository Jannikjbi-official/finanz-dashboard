import Link from "next/link";
import { LinkButton, Logo } from "@/components/site/site-links";
import { getCurrentUser } from "@/lib/server/session";

/** Oeffentliche Seiten: Startseite, Impressum, Datenschutz. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-separator">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="Jannikjbi Finanzen – Startseite" className="rounded-[var(--radius)] outline-none focus-visible:ring-2 focus-visible:ring-focus">
            <Logo />
          </Link>
          {user ? <LinkButton href="/">Zur Übersicht</LinkButton> : <LinkButton href="/anmelden">Anmelden</LinkButton>}
        </div>
      </header>

      <main id="inhalt" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-separator">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-3 px-4 py-8 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Private Finanzverwaltung. Keine Anlage-, Steuer- oder Finanzberatung.</p>
          <nav aria-label="Rechtliches" className="flex gap-4">
            <Link href="/impressum" className="hover:text-foreground">
              Impressum
            </Link>
            <Link href="/datenschutz" className="hover:text-foreground">
              Datenschutz
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
