import { Button } from "@heroui/react";
import { requireUser } from "@/lib/session";
import { getAccounts, getTransactions } from "@/lib/queries";
import { ImportForm } from "@/components/import-form";
import { PageHeader, SectionCard } from "@/components/ui";

export default async function DataPage() {
  const user = await requireUser();
  const [accounts, all] = await Promise.all([
    getAccounts(user.id),
    getTransactions(user.id),
  ]);

  const years = [...new Set(all.map((tx) => tx.date.slice(0, 4)))].sort(
    (a, b) => Number(b) - Number(a),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Import / Export"
        description="Buchungen als CSV sichern oder aus dem Online-Banking übernehmen."
      />

      <SectionCard
        title="Export"
        description={`${all.length} Buchungen insgesamt. Die Datei öffnet sich direkt in Excel oder LibreOffice.`}
      >
        <div className="flex flex-wrap gap-2">
          <Button
            as="a"
            href="/api/export"
            download
            color="primary"
            variant="flat"
            isDisabled={all.length === 0}
          >
            Alle Buchungen
          </Button>

          {years.map((year) => (
            <Button
              key={year}
              as="a"
              href={`/api/export?year=${year}`}
              download
              variant="flat"
            >
              {year}
            </Button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Import"
        description="Erkannt werden ; , und Tab als Trennzeichen, Datumsformate wie 31.12.2026 oder 2026-12-31 und Beträge mit Komma."
      >
        <ImportForm accounts={accounts} />
      </SectionCard>

      <SectionCard title="Hinweise">
        <ul className="flex list-disc flex-col gap-1.5 pl-4 text-sm text-default-500">
          <li>
            Fehlt die Spalte <strong>Typ</strong>, entscheidet das Vorzeichen:
            negative Beträge werden zu Ausgaben.
          </li>
          <li>
            Kategorien werden über den Namen zugeordnet. Passt keine, bleibt die
            Buchung ohne Kategorie – oder die Kategorie wird angelegt, wenn der
            Haken gesetzt ist.
          </li>
          <li>
            Der Import prüft nicht auf Dubletten. Dieselbe Datei zweimal
            einzulesen erzeugt doppelte Buchungen.
          </li>
        </ul>
      </SectionCard>
    </div>
  );
}
