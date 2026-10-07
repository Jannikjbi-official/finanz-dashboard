"use client";

import Link from "next/link";
import { useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { setCategoryBudget } from "@/lib/actions";
import type { BudgetProjection } from "@/lib/domain/budgets";
import { formatMoney, formatMonth, formatPercent } from "@/lib/format";
import { addMonths } from "@/lib/domain/calendar";
import { ActionForm, FormError } from "@/ui/action-form";
import { Button } from "@/ui/button";
import { AmountInput, Field } from "@/ui/field";
import { Empty, Figures, Note, PageHeader, Pill, Swatch } from "@/ui/layout";
import { Money } from "@/ui/money";
import { Sheet } from "@/ui/sheet";
import { cx } from "@/ui/cx";
import { centsToInput } from "@/features/shared/types";

export type BudgetLine = {
  categoryId: string;
  name: string;
  color: string;
  projection: BudgetProjection;
  history: Array<{ month: string; cents: number }>;
};

const STATUS: Record<BudgetProjection["status"], { label: string; tone: "pos" | "warn" | "caution" | "neg" | "neutral" } | null> = {
  none: null,
  ok: { label: "im Rahmen", tone: "pos" },
  watch: { label: "im Blick behalten", tone: "warn" },
  "projected-over": { label: "wird knapp", tone: "caution" },
  over: { label: "überschritten", tone: "neg" },
};

export function BudgetsView({ month, today, lines }: { month: string; today: string; lines: BudgetLine[] }) {
  const [editing, setEditing] = useState<BudgetLine | null>(null);

  const withBudget = lines.filter((l) => l.projection.budgetCents);
  const without = lines.filter((l) => !l.projection.budgetCents);
  const budgetTotal = withBudget.reduce((s, l) => s + (l.projection.budgetCents ?? 0), 0);
  const spentTotal = withBudget.reduce((s, l) => s + l.projection.spentCents, 0);
  const projectedTotal = withBudget.reduce((s, l) => s + l.projection.projectedCents, 0);
  const isCurrent = month === today.slice(0, 7);
  const elapsed = withBudget[0]?.projection.elapsed ?? lines[0]?.projection.elapsed ?? 0;

  return (
    <>
      <PageHeader
        title="Budgets"
        description="Monatsgrenzen für variable Ausgaben – mit Hochrechnung, wo du am Monatsende landest."
        actions={
          <div className="flex items-center gap-1">
            <Link aria-label="Vorheriger Monat" href={`?monat=${addMonths(`${month}-01`, -1).slice(0, 7)}`} className="rounded-sm p-2 text-ink-2 hover:bg-sunken">
              <CaretLeft size={16} />
            </Link>
            <span className="min-w-36 text-center text-[14px] font-medium">{formatMonth(month)}</span>
            <Link aria-label="Nächster Monat" href={`?monat=${addMonths(`${month}-01`, 1).slice(0, 7)}`} className="rounded-sm p-2 text-ink-2 hover:bg-sunken">
              <CaretRight size={16} />
            </Link>
          </div>
        }
      />

      <Figures
        className="mb-10"
        items={[
          { label: "Budget gesamt", value: <Money cents={budgetTotal} whole />, note: `${withBudget.length} Kategorien` },
          { label: "Verbraucht", value: <Money cents={spentTotal} />, note: budgetTotal ? `${formatPercent(spentTotal / budgetTotal)} des Budgets` : undefined },
          { label: "Rest", value: <Money cents={budgetTotal - spentTotal} className={budgetTotal - spentTotal < 0 ? "text-neg" : undefined} /> },
          {
            label: isCurrent ? "Hochrechnung Monatsende" : "Ergebnis",
            value: <Money cents={projectedTotal} whole className={projectedTotal > budgetTotal ? "text-caution" : undefined} />,
            note: isCurrent ? `${Math.round(elapsed * 100)} % des Monats vorbei` : undefined,
          },
        ]}
      />

      {lines.length === 0 ? (
        <Empty title="Keine Ausgaben-Kategorien.">Lege unter Einstellungen → Kategorien welche an.</Empty>
      ) : (
        <div className="flex flex-col gap-12">
          {withBudget.length > 0 ? (
            <section>
              <h2 className="mb-3 text-[15px] font-semibold">Mit Budget</h2>
              <ul className="border-t border-ink/80">
                {withBudget.map((line) => (
                  <BudgetRow key={line.categoryId} line={line} onEdit={() => setEditing(line)} showElapsed={isCurrent} />
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h2 className="mb-1 text-[15px] font-semibold">Ohne Budget</h2>
            <p className="mb-3 text-[13px] text-ink-3">Der Durchschnitt der letzten drei Monate hilft beim Festlegen.</p>
            <ul className="border-t border-ink/80">
              {without.map((line) => (
                <li key={line.categoryId} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-line py-3 sm:grid-cols-[1fr_8rem_8rem_auto]">
                  <span className="flex items-center gap-2 text-[14px]">
                    <Swatch color={line.color} />
                    {line.name}
                  </span>
                  <span className="hidden text-right text-[13px] text-ink-2 sm:block">
                    <Money cents={line.projection.spentCents} />
                  </span>
                  <span className="hidden text-right text-[12px] text-ink-3 sm:block">
                    Ø <Money cents={line.projection.averageCents} whole />
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(line)}>
                    Budget setzen
                  </Button>
                </li>
              ))}
            </ul>
          </section>

          <Note>
            Hochrechnung: bisheriges Tempo auf den ganzen Monat gerechnet. Am Monatsanfang ist das unsicher, deshalb fließt dort der
            Durchschnitt der Vormonate stärker ein. Umbuchungen zählen nie als Ausgabe.
          </Note>
        </div>
      )}

      <BudgetSheet key={editing?.categoryId ?? "none"} line={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function BudgetRow({ line, onEdit, showElapsed }: { line: BudgetLine; onEdit: () => void; showElapsed: boolean }) {
  const { projection } = line;
  const budget = projection.budgetCents ?? 0;
  const scale = Math.max(budget, projection.projectedCents, projection.spentCents) || 1;
  const status = STATUS[projection.status];
  const pct = (value: number) => `${Math.min(100, (value / scale) * 100)}%`;
  const barColor =
    projection.status === "over" ? "bg-neg" : projection.status === "projected-over" ? "bg-caution" : projection.status === "watch" ? "bg-warn" : "bg-ink";

  return (
    <li className="border-b border-line py-4">
      <button type="button" onClick={onEdit} className="grid w-full grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-left sm:grid-cols-[14rem_1fr_auto]">
        <span className="flex items-center gap-2">
          <Swatch color={line.color} />
          <span className="text-[14px] font-medium">{line.name}</span>
          {status ? <Pill tone={status.tone}>{status.label}</Pill> : null}
        </span>

        {/* Balken: verbraucht (voll), Hochrechnung (schraffiert), Budget (Strich), Monatsfortschritt (Punkt) */}
        <span className="relative col-span-2 row-start-2 h-5 sm:col-span-1 sm:row-start-auto" aria-hidden>
          <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-sunken" />
          {projection.projectedCents > projection.spentCents ? (
            <span className="hatch absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full" style={{ left: 0, width: pct(projection.projectedCents) }} />
          ) : null}
          <span className={cx("absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full", barColor)} style={{ left: 0, width: pct(projection.spentCents) }} />
          <span className="absolute top-0 h-5 w-px bg-ink" style={{ left: pct(budget) }} />
          {showElapsed ? (
            <span className="absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink-3 bg-paper" style={{ left: pct(budget * projection.elapsed) }} />
          ) : null}
        </span>

        <span className="text-right text-[14px]">
          <Money cents={projection.spentCents} /> <span className="text-ink-3">/ {formatMoney(budget, { whole: true })}</span>
        </span>

        <span className="col-span-2 row-start-3 flex flex-wrap gap-x-5 text-[12px] text-ink-3 sm:col-span-3">
          <span>
            Rest <span className={cx("num", (projection.remainingCents ?? 0) < 0 && "text-neg")}>{formatMoney(projection.remainingCents ?? 0)}</span>
          </span>
          {projection.method !== "closed" ? (
            <span>
              Hochrechnung <span className="num">{formatMoney(projection.projectedCents, { whole: true })}</span>
            </span>
          ) : null}
          <span>
            Ø 3 Monate <span className="num">{formatMoney(projection.averageCents, { whole: true })}</span>
          </span>
          <span className="hidden sm:inline">
            Vormonate{" "}
            {line.history.map((h) => (
              <span key={h.month} className="num ml-1.5">
                {formatMonth(h.month, { short: true }).split(" ")[0]} {formatMoney(h.cents, { whole: true })}
              </span>
            ))}
          </span>
        </span>
      </button>
    </li>
  );
}

function BudgetSheet({ line, onClose }: { line: BudgetLine | null; onClose: () => void }) {
  return (
    <Sheet
      open={line !== null}
      onOpenChange={(open) => !open && onClose()}
      title={line ? `Budget ${line.name}` : "Budget"}
      description={line ? `Ø der letzten drei Monate: ${formatMoney(line.projection.averageCents)}` : undefined}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" type="submit" form="budget-form">
            Speichern
          </Button>
        </div>
      }
    >
      {line ? (
        <ActionForm id="budget-form" action={setCategoryBudget} onSuccess={onClose} className="flex flex-col gap-4">
          {({ error }) => (
            <>
              <input type="hidden" name="id" value={line.categoryId} />
              <Field label="Monatsbudget" htmlFor="budget" hint="Leer lassen, um das Budget zu entfernen.">
                <AmountInput id="budget" name="budget" defaultValue={centsToInput(line.projection.budgetCents)} autoFocus />
              </Field>
              <FormError error={error} />
            </>
          )}
        </ActionForm>
      ) : null}
    </Sheet>
  );
}
