"use client";

import { Plus } from "@phosphor-icons/react";
import { Button, Tabs, type Key } from "@heroui/react";
import { useMemo, useState } from "react";
import { ChargesChart, type ChargeMonth } from "@/components/charts/charges-chart";
import { RecurringTable } from "@/components/finance/recurring-table";
import { useQuickAdd } from "@/components/shell/quick-add";
import { Figures } from "@/components/ui/money";
import { PageHeader, Panel, SummaryCell } from "@/components/ui/panel";
import type { SubscriptionSummary } from "@/lib/domain/commitments";
import type { Account } from "@/lib/domain/types";
import { formatDayShort, formatMoney } from "@/lib/format";

export function SubscriptionsView({
  summary,
  charges,
  accounts,
  today,
}: {
  summary: SubscriptionSummary;
  charges: ChargeMonth[];
  accounts: Account[];
  today: string;
}) {
  const { openRecurring } = useQuickAdd();
  const [tab, setTab] = useState<Key>("active");
  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const add = () => openRecurring(null, { type: "expense", costType: "subscription" });

  const total = summary.active.length + summary.paused.length + summary.cancelled.length + summary.archived.length;
  const nextYearTotal = charges.reduce((sum, month) => sum + month.total, 0);
  const groups = [
    { id: "active", label: "Aktiv", entries: summary.active, empty: "Keine aktiven Abonnements." },
    { id: "paused", label: "Pausiert", entries: summary.paused, empty: "Keine pausierten Abonnements." },
    { id: "cancelled", label: "Gekündigt", entries: summary.cancelled, empty: "Keine gekündigten Abonnements." },
    { id: "archived", label: "Archiv", entries: summary.archived, empty: "Das Archiv ist leer." },
  ];

  return (
    <div>
      <PageHeader
        title="Abonnements"
        description="Monatliche Vergleichswerte und tatsächliche Abbuchungstermine"
        actions={
          <Button size="sm" onPress={add}>
            <Plus weight="bold" className="size-4" /> Abonnement hinzufügen
          </Button>
        }
      />

      {total === 0 ? (
        <Panel>
          <div className="py-8 text-center">
            <p className="font-medium">Noch keine Abonnements erfasst</p>
            <p className="mx-auto mt-1 max-w-md text-muted">
              Erfasse Streaming, Software, Mitgliedschaften und andere Abos mit Betrag, Intervall und nächstem Zahlungstermin.
            </p>
            <Button className="mt-4" onPress={add}>
              Erstes Abonnement hinzufügen
            </Button>
          </div>
        </Panel>
      ) : (
        <div className="flex flex-col gap-4">
          <section className="panel grid grid-cols-2 divide-separator md:grid-cols-4 md:divide-x" aria-label="Kostenanalyse">
            <SummaryCell label="Pro Monat" hint="Durchschnitt aller aktiven Abos" value={<Figures text={formatMoney(summary.monthlyTotal)} />} />
            <SummaryCell label="Pro Jahr" hint="Summe aller Abbuchungen in 12 Monaten" value={<Figures text={formatMoney(summary.yearlyTotal)} />} />
            <SummaryCell label="Aktive Abos" hint={summary.paused.length ? `${summary.paused.length} pausiert` : "keine pausiert"} value={summary.activeCount} />
            <SummaryCell
              label="Nächste Abbuchung"
              hint={summary.nextCharge ? `${summary.nextCharge.entry.title} · ${formatDayShort(summary.nextCharge.date)}` : "keine geplant"}
              value={summary.nextCharge ? <Figures text={formatMoney(summary.nextCharge.entry.amountCents)} /> : "–"}
            />
          </section>

          <Panel
            title="Abbuchungen der nächsten 12 Monate"
            description={
              <>
                Tatsächlich fällige Beträge je Monat, inklusive Restzahlungen gekündigter Abos – zusammen <Figures text={formatMoney(nextYearTotal)} />. Hervorgehoben: Monate über dem Durchschnitt.
              </>
            }
          >
            <ChargesChart data={charges} average={summary.monthlyTotal} />
          </Panel>

          <Tabs selectedKey={tab} onSelectionChange={setTab} variant="secondary">
            <Tabs.ListContainer>
              <Tabs.List aria-label="Status">
                {groups.map((group) => (
                  <Tabs.Tab key={group.id} id={group.id}>
                    {group.label} <span className="num ml-1 text-muted">{group.entries.length}</span>
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
            {groups.map((group) => (
              <Tabs.Panel key={group.id} id={group.id} className="pt-3">
                <RecurringTable entries={group.entries} today={today} accountName={accountName} emptyText={group.empty} ariaLabel={`Abonnements: ${group.label}`} />
              </Tabs.Panel>
            ))}
          </Tabs>
        </div>
      )}
    </div>
  );
}
