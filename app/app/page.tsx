import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { requireUser } from "@/lib/session";
import { getBalanceHistory, getMonthFlows, loadFinancialPicture } from "@/lib/server/finance";
import { buildInsights, type Insight } from "@/lib/server/insights";
import { horizonBalances, type ForecastEvent } from "@/lib/domain/forecast";
import { addDays, monthOf, shiftMonth } from "@/lib/domain/calendar";
import { changeRatio, savingsRate } from "@/lib/domain/insights";
import { formatDateLong, formatDayShort, formatDayWithWeekday, formatMoney, formatPercent, formatRelativeDays } from "@/lib/format";
import { Money, Delta } from "@/ui/money";
import { Figures, Section, Empty, Pill } from "@/ui/layout";
import { SafetyScale } from "@/ui/safety";
import { TimelineChart } from "@/ui/timeline-chart";
import { ButtonLink } from "@/ui/button";
import { cx } from "@/ui/cx";

export const metadata = { title: "Lage" };

const SOURCE_LABEL: Record<ForecastEvent["source"], string> = {
  recurring: "Fix",
  planned: "Geplant",
  goal: "Sparrate",
  scenario: "Szenario",
};

export default async function LagePage() {
  const user = await requireUser();
  const picture = await loadFinancialPicture(user.id, { horizonDays: 90 });
  const { today, safety, forecast } = picture;
  const month = monthOf(today);

  // Neue Nutzer zuerst durch die Einrichtung
  if (!picture.settings.onboardingCompletedAt && picture.accounts.length === 0) redirect("/willkommen");

  const liquidIds = picture.usesAccounts
    ? picture.accounts.filter((a) => a.liquid && !a.archived).map((a) => a.id)
    : null;

  const [history, flows, insights] = await Promise.all([
    getBalanceHistory(user.id, today, 60, picture.openingBalanceCents, liquidIds),
    getMonthFlows(user.id, shiftMonth(month, -1), month),
    buildInsights(user.id, picture),
  ]);

  const isEmpty =
    picture.accounts.length === 0 && picture.recurring.length === 0 && history.every((p) => p.balanceCents === 0);

  if (isEmpty) {
    return (
      <div className="max-w-2xl">
        <p className="text-[13px] text-ink-3">{formatDateLong(today)}</p>
        <h1 className="mt-1 font-serif text-[34px] leading-tight tracking-[-0.01em]">Noch ist hier nichts erfasst.</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          Lege ein Konto mit seinem aktuellen Stand an und trag dein Einkommen sowie die festen Kosten ein. Ab dann rechnet die
          Lage 90 Tage voraus.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <ButtonLink href="/willkommen" variant="primary">
            Einrichtung starten
          </ButtonLink>
          <ButtonLink href="/app/geld/import">Buchungen importieren</ButtonLink>
        </div>
      </div>
    );
  }

  const reserves = picture.accounts
    .filter((a) => !a.liquid && !a.archived)
    .reduce((sum, a) => sum + a.balanceCents, 0);
  const liquidCount = picture.accounts.filter((a) => a.liquid && !a.archived).length;

  const upcoming = forecast.events.filter((event) => event.date <= addDays(today, 14));
  const byDay = new Map<string, ForecastEvent[]>();
  for (const event of upcoming) byDay.set(event.date, [...(byDay.get(event.date) ?? []), event]);

  const [prev, current] = flows;
  const net = current.incomeCents - current.expenseCents;
  const rate = savingsRate(current.incomeCents, current.expenseCents);
  const expenseChange = changeRatio(current.expenseCents, prev.expenseCents);

  return (
    <div className="flex flex-col gap-10">
      {/* ------------------------- Wie steht es? ------------------------- */}
      <section className="grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-12">
        <div>
          <p className="text-[13px] text-ink-3">{formatDateLong(today)} · verfügbar</p>
          <Money cents={picture.openingBalanceCents} className="mt-1 block text-[44px] font-medium leading-none tracking-[-0.03em] sm:text-[52px]" />
          <p className="mt-2 text-[13px] text-ink-3">
            {picture.usesAccounts
              ? `aus ${liquidCount} ${liquidCount === 1 ? "Konto" : "Konten"}${reserves > 0 ? ` · zusätzlich ${formatMoney(reserves, { whole: true })} in Rücklagen` : ""}`
              : "Summe aller Buchungen – lege Konten an, um echte Kontostände zu sehen."}
          </p>

          <div className="mt-6 border-t border-line pt-4">
            <SafetyScale level={safety.level} />
            <ul className="mt-2 flex flex-col gap-1">
              {safety.reasons.map((reason) => (
                <li key={reason} className="max-w-xl text-[14px] leading-relaxed text-ink-2">
                  {reason}
                </li>
              ))}
            </ul>
            <Link href="/app/einstellungen#reserve" className="mt-2 inline-block text-[13px] text-ink-3 underline-offset-4 hover:text-ink hover:underline">
              Wie die Einstufung entsteht
            </Link>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-4 border-t border-line pt-4 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
          <div>
            <p className="text-[13px] text-ink-3">Spielraum</p>
            <Money cents={safety.headroomCents} whole className="mt-1 block text-[32px] font-medium leading-none tracking-[-0.02em]" />
            <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
              {safety.headroomCents > 0
                ? `So viel kannst du heute zusätzlich ausgeben, ohne in den nächsten 90 Tagen unter ${safety.reserveCents > 0 ? `deine Reserve von ${formatMoney(safety.reserveCents, { whole: true })}` : "null"} zu fallen.`
                : "Aktuell gibt es keinen Puffer über der Reserve – jede zusätzliche Ausgabe geht an die Reserve."}
            </p>
          </div>
          <Link
            href="/app/entscheiden"
            className="group inline-flex items-center gap-1.5 self-start text-[14px] font-medium text-accent"
          >
            Kann ich mir etwas leisten?
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      {/* ---------------------------- Zeitachse --------------------------- */}
      <section className="border-t border-ink/80 pt-3">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-semibold">60 Tage zurück, 90 Tage voraus</h2>
          <p className="text-[12px] text-ink-3">
            Prognose aus Fixkosten, Geplantem, Sparraten und{" "}
            {picture.monthly.variableSource === "history"
              ? `Ø variablen Ausgaben (${formatMoney(picture.monthly.variableCents, { whole: true })}/Monat)`
              : picture.monthly.variableSource === "estimate"
                ? `geschätzten Alltagsausgaben (${formatMoney(picture.monthly.variableCents, { whole: true })}/Monat)`
                : "noch ohne Alltagsausgaben"}
          </p>
        </div>
        <TimelineChart
          series={{ past: history, future: forecast.days.map((d) => ({ date: d.date, balanceCents: d.balanceCents })) }}
          events={forecast.events.map((e) => ({ date: e.date, amountCents: e.amountCents, label: e.label }))}
          reserveCents={safety.reserveCents}
          ariaLabel={`Kontostand: heute ${formatMoney(picture.openingBalanceCents)}, tiefster Stand der nächsten 90 Tage ${formatMoney(safety.low90.balanceCents)} am ${formatDayShort(safety.low90.date)}`}
        />
        <Figures
          className="mt-2"
          items={horizonBalances(forecast).map((h) => ({
            label: `in ${h.days} Tagen`,
            value: <Money cents={h.balanceCents} whole className={h.balanceCents < safety.reserveCents ? "text-caution" : undefined} />,
            note: formatDayShort(h.date),
          }))}
        />
      </section>

      {/* ----------------------- Was kommt / beachten --------------------- */}
      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
        <Section
          title="Als Nächstes"
          description="Die nächsten 14 Tage"
          aside={
            <Link href="/app/planung" className="text-ink-3 hover:text-ink">
              Kalender
            </Link>
          }
        >
          {byDay.size === 0 ? (
            <Empty title="In den nächsten zwei Wochen steht nichts an.">
              Fixkosten und geplante Ausgaben erscheinen hier, sobald sie fällig werden.
            </Empty>
          ) : (
            <ol className="flex flex-col">
              {[...byDay.entries()].map(([date, events]) => {
                const day = forecast.days.find((d) => d.date === date);
                const offset = forecast.days.findIndex((d) => d.date === date);
                return (
                  <li key={date} className="grid grid-cols-[6.5rem_1fr] gap-3 border-b border-line py-3 sm:grid-cols-[8rem_1fr]">
                    <div>
                      <p className="text-[13px] font-medium">{formatDayWithWeekday(date)}</p>
                      <p className="text-[12px] text-ink-3">{formatRelativeDays(offset)}</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {events.map((event, index) => (
                        <div key={index} className="flex items-baseline justify-between gap-3">
                          <span className="flex min-w-0 items-baseline gap-2">
                            <span className="truncate text-[14px]">{event.label}</span>
                            <span className="shrink-0 text-[11px] text-ink-3">{event.overdue ? "überfällig" : SOURCE_LABEL[event.source]}</span>
                          </span>
                          <Money cents={event.amountCents} tone="flow" className="text-[14px]" />
                        </div>
                      ))}
                      {day ? (
                        <p className="text-right text-[12px] text-ink-3">
                          danach <span className="num">{formatMoney(day.balanceCents)}</span>
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Section>

        <Section title="Beachten">
          <InsightList insights={insights} />
        </Section>
      </div>

      {/* ---------------------------- Dieser Monat ------------------------ */}
      <Section
        title="Dieser Monat bisher"
        aside={
          <Link href="/app/rueckblick" className="text-ink-3 hover:text-ink">
            Monatsbericht
          </Link>
        }
      >
        <Figures
          items={[
            { label: "Einnahmen", value: <Money cents={current.incomeCents} />, note: `Vormonat ${formatMoney(prev.incomeCents, { whole: true })}` },
            {
              label: "Ausgaben",
              value: <Money cents={current.expenseCents} />,
              note: prev.expenseCents > 0 ? `Vormonat ${formatMoney(prev.expenseCents, { whole: true })}` : "kein Vormonat",
            },
            { label: "Saldo", value: <Money cents={net} tone="flow" /> },
            {
              label: "Sparquote",
              value: rate !== null ? <span className="num">{formatPercent(rate)}</span> : <span className="text-ink-3">–</span>,
              note: rate !== null ? "Anteil der Einnahmen, der bleibt" : "noch keine Einnahmen",
            },
          ]}
        />
        {expenseChange !== null && prev.expenseCents > 0 ? (
          <p className="mt-3 text-[13px] text-ink-3">
            Ausgaben bisher <Delta value={expenseChange} invert text={formatPercent(expenseChange, { signed: true })} /> gegenüber dem
            ganzen Vormonat.
          </p>
        ) : null}
      </Section>
    </div>
  );
}

const TONE_BAR: Record<Insight["tone"], string> = {
  neg: "bg-neg",
  caution: "bg-caution",
  warn: "bg-warn",
  info: "bg-line-strong",
  pos: "bg-pos",
};

function InsightList({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return <Empty title="Nichts Besonderes.">Sobald Buchungen und Budgets vorliegen, erscheinen hier Hinweise.</Empty>;
  }
  return (
    <ul className="flex flex-col">
      {insights.map((insight) => {
        const body = (
          <div className="flex gap-3 py-3">
            <span aria-hidden className={cx("mt-1.5 h-3 w-[3px] shrink-0 rounded-full", TONE_BAR[insight.tone])} />
            <div className="min-w-0">
              <p className="text-[14px] font-medium leading-snug">{insight.title}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{insight.detail}</p>
              {insight.action ? <Pill tone="accent" className="mt-1.5">{insight.action}</Pill> : null}
            </div>
          </div>
        );
        return (
          <li key={insight.id} className="border-b border-line">
            {insight.href ? (
              <Link href={insight.href} className="block hover:bg-sunken/60">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
