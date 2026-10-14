import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Figures, Money } from "@/components/ui/money";
import { PageHeader, Panel, SummaryCell } from "@/components/ui/panel";
import { Status } from "@/components/ui/status";
import { shiftMonth } from "@/lib/domain/calendar";
import { aboveAverage, type CategoryStat } from "@/lib/domain/categories";
import type { MonthReview } from "@/lib/domain/review";
import { formatDayShort, formatMoney, formatMonth, formatPercent } from "@/lib/format";

function Delta({ current, compare, label }: { current: number; compare: number; label: string }) {
  const diff = current - compare;
  if (compare === 0) return null;
  return (
    <span className={diff > 0 ? "text-warning" : "text-success"}>
      {formatMoney(diff, { signed: true })} ggü. {label}
    </span>
  );
}

function CategoryList({ items, kind }: { items: CategoryStat[]; kind: "expense" | "income" }) {
  const shown = items.filter((item) => item.amount > 0);
  const max = Math.max(...shown.map((item) => Math.max(item.amount, item.average ?? 0)), 1);
  if (shown.length === 0) return <p className="px-4 py-6 text-center text-muted sm:px-5">Nichts gebucht.</p>;
  return (
    <ul className="rows">
      {shown.map((item) => (
        <li key={item.id}>
          <Link
            href={`/kategorien/${item.id}${kind === "income" ? "?art=einnahmen" : ""}`}
            className="block px-4 py-2.5 outline-none hover:bg-surface-secondary focus-visible:bg-surface-secondary sm:px-5"
          >
            <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
              <span className="flex min-w-0 items-center gap-2">
                <span className="size-2 shrink-0 rounded-full" style={{ background: item.color ?? "var(--muted)" }} aria-hidden />
                <span className="truncate">{item.name}</span>
                {kind === "expense" && aboveAverage(item) && <Status tone="warning">über Ø</Status>}
              </span>
              <span className="flex shrink-0 items-baseline gap-2">
                <span className="label font-normal">{formatPercent(item.share)}</span>
                <Money cents={item.amount} tone="plain" className="font-medium" />
              </span>
            </div>
            <div className="relative mt-1.5 h-1 overflow-hidden rounded-full bg-surface-secondary">
              <div className="h-full rounded-full" style={{ width: `${(item.amount / max) * 100}%`, background: item.color ?? "var(--muted)" }} />
              {item.average !== null && item.average > 0 && (
                <div className="absolute inset-y-0 w-0.5 bg-foreground/60" style={{ left: `calc(${(item.average / max) * 100}% - 1px)` }} />
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Rueckblick auf einen Monat. */
export function ReviewView({ review, currentMonth }: { review: MonthReview; currentMonth: string }) {
  const { month, summary, previous, baseline, savingsRate } = review;
  const empty = summary.count === 0;

  return (
    <div>
      <PageHeader
        title={`Rückblick ${formatMonth(month)}`}
        description={
          review.running
            ? "Der Monat läuft noch – Zahlen bisher."
            : review.partialFrom
              ? `Erfasst ab ${formatDayShort(review.partialFrom)} – der Monat ist nur teilweise enthalten.`
              : "Gebuchte Beträge, ohne Transfers zwischen eigenen Konten."
        }
        actions={
          <nav aria-label="Monat" className="flex items-center gap-1">
            <Link href={`/rueckblick?monat=${shiftMonth(month, -1)}`} className="rounded-[var(--radius)] p-1.5 text-muted hover:bg-default hover:text-foreground" aria-label="Vormonat">
              <CaretLeft className="size-4" />
            </Link>
            <span className="min-w-32 text-center text-[13.5px] font-medium">{formatMonth(month)}</span>
            {month < currentMonth ? (
              <Link href={`/rueckblick?monat=${shiftMonth(month, 1)}`} className="rounded-[var(--radius)] p-1.5 text-muted hover:bg-default hover:text-foreground" aria-label="Nächster Monat">
                <CaretRight className="size-4" />
              </Link>
            ) : (
              <span className="p-1.5 text-muted/40" aria-hidden>
                <CaretRight className="size-4" />
              </span>
            )}
          </nav>
        }
      />

      {empty ? (
        <Panel>
          <p className="py-8 text-center text-muted">Für {formatMonth(month)} ist nichts gebucht.</p>
        </Panel>
      ) : (
        <div className="flex flex-col gap-4">
          <section className="panel grid grid-cols-2 md:grid-cols-4 md:divide-x md:divide-separator" aria-label="Kennzahlen">
            <SummaryCell
              label={summary.net >= 0 ? "Überschuss" : "Fehlbetrag"}
              hint={savingsRate !== null ? `${formatPercent(Math.max(savingsRate, 0))} der Einnahmen gespart` : "keine Einnahmen"}
              value={<Money cents={summary.net} signed />}
            />
            <SummaryCell label="Einnahmen" hint={review.previousComparable ? <Delta current={summary.income} compare={previous.income} label="Vormonat" /> : " "} value={<Figures text={formatMoney(summary.income)} />} />
            <SummaryCell
              label="Ausgaben"
              hint={
                baseline ? (
                  <Delta current={summary.expense} compare={baseline.averageExpense} label="Ø" />
                ) : review.previousComparable ? (
                  <Delta current={summary.expense} compare={previous.expense} label="Vormonat" />
                ) : (
                  `${summary.count} Buchungen`
                )
              }
              value={<Figures text={formatMoney(summary.expense)} />}
            />
            <SummaryCell
              label="Davon fest"
              hint={`${review.recurringPaid.count} regelmäßige Zahlungen · variabel ${formatMoney(summary.variable)}`}
              value={<Figures text={formatMoney(summary.fixed)} />}
            />
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Ausgaben nach Kategorie" description={baseline ? "Strich: Ø vollständiger Monate davor" : undefined} bodyClassName="">
              <CategoryList items={review.expenseCategories.items} kind="expense" />
            </Panel>
            <div className="flex flex-col gap-4">
              <Panel title="Größte Ausgaben" bodyClassName="">
                <ul className="rows">
                  {review.largest.map((tx) => (
                    <li key={tx.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-[13.5px] sm:px-5">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{tx.title}</span>
                        <span className="label block font-normal">{formatDayShort(tx.date)}</span>
                      </span>
                      <Money cents={-tx.amountCents} signed tone="plain" className="shrink-0" />
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel title="Einnahmen" bodyClassName="">
                <CategoryList items={review.incomeCategories.items} kind="income" />
              </Panel>
            </div>
          </div>
          <p className="label px-1 font-normal">
            {summary.count} Buchungen, an {review.spendingDays} Tagen Ausgaben.{" "}
            <Link href={`/transaktionen?monat=${month}`} className="underline decoration-border underline-offset-4 hover:text-foreground">
              Alle Buchungen des Monats
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
