import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Figures, Money } from "@/components/ui/money";
import { PageHeader } from "@/components/ui/panel";
import { Status } from "@/components/ui/status";
import { shiftMonth } from "@/lib/domain/calendar";
import { aboveAverage, type CategoryBreakdown } from "@/lib/domain/categories";
import { formatDayShort, formatMoney, formatMonth } from "@/lib/format";

function href(month: string, kind: "expense" | "income") {
  const params = new URLSearchParams({ monat: month });
  if (kind === "income") params.set("art", "einnahmen");
  return `/kategorien?${params}`;
}

/** Ausgaben bzw. Einnahmen eines Monats je Kategorie, verglichen mit dem Durchschnitt. */
export function CategoriesView({ breakdown, currentMonth }: { breakdown: CategoryBreakdown; currentMonth: string }) {
  const { month, kind, items, total, averageMonths } = breakdown;
  const isCurrent = month === currentMonth;
  const averageTotal = averageMonths.length > 0 ? items.reduce((sum, item) => sum + (item.average ?? 0), 0) : null;
  const max = Math.max(...items.map((item) => Math.max(item.amount, item.average ?? 0)), 1);
  const noun = kind === "expense" ? "Ausgaben" : "Einnahmen";

  return (
    <div>
      <PageHeader
        title="Kategorien"
        description={
          averageMonths.length > 0
            ? `${noun} je Kategorie, verglichen mit dem Ø von ${averageMonths.map((m) => formatMonth(m, { short: true })).join(", ")}`
            : `${noun} je Kategorie. Ein Durchschnitt erscheint, sobald ein Monat vollständig erfasst ist.`
        }
        actions={
          <>
            <Link href={`/rueckblick?monat=${month}`} className="rounded-[var(--radius)] px-2 py-1 text-[13px] text-muted hover:bg-default hover:text-foreground">
              Rückblick
            </Link>
            <nav aria-label="Art" className="flex rounded-[var(--radius)] bg-surface-secondary p-0.5 text-[13px]">
              {(["expense", "income"] as const).map((value) => (
                <Link
                  key={value}
                  href={href(month, value)}
                  aria-current={kind === value ? "page" : undefined}
                  className={`rounded-[calc(var(--radius)-2px)] px-3 py-1 ${kind === value ? "bg-background font-medium shadow-sm" : "text-muted hover:text-foreground"}`}
                >
                  {value === "expense" ? "Ausgaben" : "Einnahmen"}
                </Link>
              ))}
            </nav>
            <nav aria-label="Monat" className="flex items-center gap-1">
              <Link href={href(shiftMonth(month, -1), kind)} className="rounded-[var(--radius)] p-1.5 text-muted hover:bg-default hover:text-foreground" aria-label="Vormonat">
                <CaretLeft className="size-4" />
              </Link>
              <span className="min-w-32 text-center text-[13.5px] font-medium">{formatMonth(month)}</span>
              {isCurrent ? (
                <span className="p-1.5 text-muted/40" aria-hidden>
                  <CaretRight className="size-4" />
                </span>
              ) : (
                <Link href={href(shiftMonth(month, 1), kind)} className="rounded-[var(--radius)] p-1.5 text-muted hover:bg-default hover:text-foreground" aria-label="Nächster Monat">
                  <CaretRight className="size-4" />
                </Link>
              )}
            </nav>
          </>
        }
      />

      <section className="panel">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-separator px-4 py-3 text-[13.5px] sm:px-5">
          <span>
            <span className="text-muted">{isCurrent ? `${noun} bisher` : noun} </span>
            <span className="font-semibold">
              <Figures text={formatMoney(total)} />
            </span>
            {breakdown.partialFrom && <span className="text-muted"> · erfasst ab {formatDayShort(breakdown.partialFrom)}</span>}
          </span>
          {averageTotal !== null && (
            <span className="text-muted">
              Ø Monat <Money cents={averageTotal} tone="plain" className="text-foreground" />
            </span>
          )}
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-10 text-center text-muted sm:px-5">Keine gebuchten {noun} in diesem Monat.</p>
        ) : (
          <ul className="rows">
            {items.map((item) => (
              <li key={item.id}>
                <Link href={`/kategorien/${item.id}${kind === "income" ? "?art=einnahmen" : ""}`} className="block px-4 py-3 outline-none hover:bg-surface-secondary focus-visible:bg-surface-secondary sm:px-5">
                  <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: item.color ?? "var(--muted)" }} aria-hidden />
                      <span className="truncate font-medium">{item.name}</span>
                      {item.count > 0 && <span className="label shrink-0 font-normal">{item.count}×</span>}
                    </span>
                    <span className="flex shrink-0 items-baseline gap-3">
                      {kind === "expense" && aboveAverage(item) && (
                        <Status tone="warning">{isCurrent ? "schon über Ø" : "über Ø"}</Status>
                      )}
                      <Money cents={item.amount} tone="plain" className="font-medium" />
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-secondary">
                      <div className="h-full rounded-full" style={{ width: `${(item.amount / max) * 100}%`, background: item.color ?? "var(--muted)" }} />
                      {item.average !== null && item.average > 0 && (
                        <div className="absolute inset-y-0 w-0.5 bg-foreground/60" style={{ left: `calc(${(item.average / max) * 100}% - 1px)` }} title="Durchschnitt" />
                      )}
                    </div>
                    <span className="label w-20 shrink-0 text-right font-normal sm:w-28">
                      {item.average !== null ? `Ø ${formatMoney(item.average)}` : `${Math.round(item.share * 100)} %`}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="label mt-3 px-1 font-normal">
        Nur gebuchte Beträge, ohne Transfers zwischen eigenen Konten. Der Strich zeigt den Durchschnitt vollständig erfasster Monate.
      </p>
    </div>
  );
}
