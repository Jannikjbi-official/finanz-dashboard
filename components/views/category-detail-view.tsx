"use client";

import { ArrowLeft, ListMagnifyingGlass } from "@phosphor-icons/react";
import Link from "next/link";
import { MonthBars } from "@/components/charts/month-bars";
import { useQuickAdd } from "@/components/shell/quick-add";
import { Figures, Money } from "@/components/ui/money";
import { PageHeader, Panel, SummaryCell } from "@/components/ui/panel";
import { Status } from "@/components/ui/status";
import { NO_CATEGORY, type CategoryDetail } from "@/lib/domain/categories";
import { INTERVAL_LABEL } from "@/lib/domain/labels";
import { monthlyEquivalent } from "@/lib/domain/recurring";
import type { CategoryRule } from "@/lib/domain/rules";
import type { Recurring } from "@/lib/domain/types";
import { formatDate, formatDayShort, formatMoney, formatMonth } from "@/lib/format";

/** Eine Kategorie im Detail: Verlauf, Durchschnitt, Empfaenger, Buchungen, Regeln. */
export function CategoryDetailView({
  name,
  color,
  detail,
  rules,
  recurring,
}: {
  name: string;
  color: string | null;
  detail: CategoryDetail;
  rules: CategoryRule[];
  recurring: Recurring[];
}) {
  const { openTransaction, openRecurring } = useQuickAdd();
  const current = detail.history.find((month) => month.current) ?? null;
  const noun = detail.kind === "expense" ? "Ausgaben" : "Einnahmen";
  const filterHref = `/transaktionen?monat=alle&kategorie=${detail.id === NO_CATEGORY ? "ohne" : detail.id}`;
  const fixedMonthly = recurring.filter((entry) => entry.status === "active").reduce((sum, entry) => sum + monthlyEquivalent(entry), 0);
  const months = detail.history.length;

  return (
    <div>
      <Link href={`/kategorien${detail.kind === "income" ? "?art=einnahmen" : ""}`} className="label mb-2 inline-flex items-center gap-1 font-normal hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Alle Kategorien
      </Link>
      <PageHeader
        title={name}
        description={
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: color ?? "var(--muted)" }} aria-hidden />
            {detail.kind === "expense" ? "Ausgaben-Kategorie" : "Einnahmen-Kategorie"}
          </span>
        }
        actions={
          <Link href={filterHref} className="inline-flex h-8 items-center gap-2 rounded-[var(--radius)] bg-default px-3 text-sm font-medium hover:bg-default-hover">
            <ListMagnifyingGlass className="size-4" /> Alle Buchungen
          </Link>
        }
      />

      <div className="flex flex-col gap-4">
        <section className="panel grid grid-cols-2 md:grid-cols-4 md:divide-x md:divide-separator" aria-label="Kennzahlen">
          <SummaryCell
            label={current ? `${formatMonth(current.month)} bisher` : "Dieser Monat"}
            hint={current ? `${current.count} Buchungen` : "noch nichts gebucht"}
            value={<Figures text={formatMoney(current?.amount ?? 0)} />}
          />
          <SummaryCell
            label="Ø Monat"
            hint={detail.averageMonths.length > 0 ? `aus ${detail.averageMonths.length} vollständigen Monaten` : "noch kein vollständiger Monat"}
            value={detail.average !== null ? <Figures text={formatMoney(detail.average)} /> : "–"}
          />
          <SummaryCell
            label={months >= 12 ? "Letzte 12 Monate" : `Seit ${formatMonth(detail.history[0]?.month ?? "", { short: true })}`}
            hint={`${detail.history.reduce((sum, month) => sum + month.count, 0)} Buchungen`}
            value={<Figures text={formatMoney(detail.yearTotal)} />}
          />
          <SummaryCell
            label="Davon regelmäßig"
            hint={recurring.length > 0 ? `${recurring.length} feste ${recurring.length === 1 ? "Zahlung" : "Zahlungen"} pro Monat` : "keine festen Zahlungen"}
            value={<Figures text={formatMoney(fixedMonthly)} />}
          />
        </section>

        <Panel title="Verlauf" description={`Gebuchte ${noun} je Monat`}>
          {detail.history.every((month) => month.amount === 0) ? (
            <p className="py-6 text-center text-muted">Noch keine gebuchten {noun} in dieser Kategorie.</p>
          ) : (
            <MonthBars data={detail.history} average={detail.average} color={color} />
          )}
        </Panel>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title={detail.kind === "expense" ? "Häufigste Empfänger" : "Häufigste Absender"} description="Letzte 12 Monate, nach Betrag" bodyClassName="">
            {detail.payees.length === 0 ? (
              <p className="px-4 py-6 text-center text-muted sm:px-5">Noch keine Buchungen.</p>
            ) : (
              <ul className="rows">
                {detail.payees.map((payee) => (
                  <li key={payee.name} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-[13.5px] sm:px-5">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{payee.name}</span>
                      <span className="label block font-normal">
                        {payee.count}× · zuletzt {formatDayShort(payee.last)}
                      </span>
                    </span>
                    <Money cents={payee.amount} tone="plain" className="shrink-0" />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Feste Zahlungen und Regeln" bodyClassName="">
            {recurring.length === 0 && rules.length === 0 ? (
              <p className="px-4 py-6 text-[13.5px] text-muted sm:px-5">
                Keine regelmäßigen Zahlungen und keine Regeln mit dieser Kategorie.{" "}
                <Link href="/einstellungen#regeln" className="text-foreground underline decoration-border underline-offset-4">
                  Regel anlegen
                </Link>
              </p>
            ) : (
              <ul className="rows">
                {recurring.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => openRecurring(entry)}
                      className="flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-left text-[13.5px] outline-none hover:bg-surface-secondary focus-visible:bg-surface-secondary sm:px-5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{entry.title}</span>
                        <span className="label block font-normal">
                          {INTERVAL_LABEL[entry.interval]} · nächste {formatDayShort(entry.nextDue)}
                          {entry.status !== "active" && " · nicht aktiv"}
                        </span>
                      </span>
                      <Money cents={entry.amountCents} tone="plain" className="shrink-0" />
                    </button>
                  </li>
                ))}
                {rules.map((rule) => (
                  <li key={rule.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-[13.5px] sm:px-5">
                    <span className="min-w-0 truncate">
                      Regel: enthält „<span className="font-medium">{rule.match}</span>“
                    </span>
                    <Link href="/einstellungen#regeln" className="label shrink-0 font-normal hover:text-foreground">
                      bearbeiten
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel
          title="Letzte Buchungen"
          bodyClassName=""
          action={
            <Link href={filterHref} className="label font-normal hover:text-foreground">
              Alle anzeigen
            </Link>
          }
        >
          {detail.recent.length === 0 ? (
            <p className="px-4 py-6 text-center text-muted sm:px-5">Noch keine Buchungen.</p>
          ) : (
            <ul className="rows">
              {detail.recent.map((tx) => (
                <li key={tx.id}>
                  <button
                    type="button"
                    onClick={() => openTransaction(tx.type, tx)}
                    className="flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-left text-[13.5px] outline-none hover:bg-surface-secondary focus-visible:bg-surface-secondary sm:px-5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{tx.title}</span>
                      <span className="label block font-normal">{formatDate(tx.date)}</span>
                    </span>
                    <span className="flex shrink-0 items-baseline gap-2">
                      {tx.status === "pending" && <Status tone="warning">{tx.type === "income" ? "erwartet" : "geplant"}</Status>}
                      <Money
                        cents={tx.type === "income" ? tx.amountCents : -tx.amountCents}
                        signed
                        tone="plain"
                        className={`${tx.type === "income" ? "text-success" : ""} ${tx.status === "pending" ? "opacity-60" : ""}`}
                      />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
