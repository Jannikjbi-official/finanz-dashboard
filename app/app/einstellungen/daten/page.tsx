import Link from "next/link";
import { requireUser } from "@/lib/session";
import { transactions } from "@/lib/mongo";
import { PageHeader, Section } from "@/ui/layout";
import { buttonClass } from "@/ui/button";
import { DeleteAccount } from "@/features/settings/account-security";

export const metadata = { title: "Daten & Datenschutz" };

export default async function DatenPage() {
  const user = await requireUser();
  const years = (await transactions.distinct("date", { userId: user.id }))
    .map((date) => String(date).slice(0, 4))
    .filter((year, index, list) => list.indexOf(year) === index)
    .sort()
    .reverse();

  return (
    <div className="flex max-w-3xl flex-col gap-12">
      <PageHeader title="Daten & Datenschutz" description="Deine Daten gehören dir. Hier nimmst du sie mit oder löschst sie." />

      <Section title="Exportieren">
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-[14px] font-medium">Vollständiger Export (JSON)</p>
            <p className="mt-0.5 text-[13px] text-ink-2">
              Alle Konten, Buchungen, Kategorien, Fixkosten, geplanten Posten, Ziele, Szenarien und Einstellungen in einer maschinenlesbaren
              Datei – zum Archivieren oder Umziehen.
            </p>
            <a href="/api/export?format=json" download className={buttonClass("secondary", "sm", "mt-2")}>
              JSON herunterladen
            </a>
          </div>
          <div>
            <p className="text-[14px] font-medium">Buchungen als Tabelle (CSV)</p>
            <p className="mt-0.5 text-[13px] text-ink-2">Öffnet sich direkt in Excel, Numbers oder LibreOffice.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a href="/api/export" download className={buttonClass("secondary", "sm")}>
                Alle Buchungen
              </a>
              {years.map((year) => (
                <a key={year} href={`/api/export?year=${year}`} download className={buttonClass("ghost", "sm")}>
                  {year}
                </a>
              ))}
            </div>
          </div>
          <p className="text-[13px] text-ink-3">
            Daten aus einer anderen App übernehmen?{" "}
            <Link href="/app/geld/import" className="text-accent hover:underline">
              Zum Import
            </Link>
          </p>
        </div>
      </Section>

      <Section title="Was gespeichert wird">
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[14px] leading-relaxed text-ink-2">
          <li>Deine Anmeldedaten (E-Mail, Name, Passwort nur als sicherer Hash) und aktive Sitzungen.</li>
          <li>Was du selbst einträgst oder importierst: Konten, Buchungen, Kategorien, Fixkosten, geplante Posten, Ziele, Szenarien.</li>
          <li>Keine Verbindung zu deiner Bank, kein Tracking, keine Werbung, keine Weitergabe an Dritte.</li>
          <li>
            Mehr dazu in der{" "}
            <Link href="/datenschutz" className="text-accent hover:underline">
              Datenschutzerklärung
            </Link>
            .
          </li>
        </ul>
      </Section>

      <Section title="Konto löschen">
        <p className="mb-4 text-[14px] leading-relaxed text-ink-2">
          Löscht dein Konto und sämtliche Finanzdaten sofort. Das lässt sich nicht rückgängig machen.
        </p>
        <DeleteAccount email={user.email} />
      </Section>
    </div>
  );
}
