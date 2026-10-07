import Link from "next/link";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/server/user-data";
import { getMonthReport } from "@/lib/server/reports";
import { goals as goalsCollection } from "@/lib/mongo";
import { goalState } from "@/lib/domain/goals";
import { isMonthKey, shiftMonth, todayIn } from "@/lib/domain/calendar";
import { changeRatio } from "@/lib/domain/insights";
import { formatDayShort, formatMoney, formatMonth, formatPercent, monthName } from "@/lib/format";
import { Empty, Figures, Note, Section, Swatch } from "@/ui/layout";
import { Delta, Money } from "@/ui/money";
import { cx } from "@/ui/cx";

export const metadata = { title: "Monatsbericht" };

export default async function MonatsberichtPage({ searchParams }: { searchParams: Promise<{ monat?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const settings = await getSettings(user.id);
  const today = todayIn(settings.timeZone);
  // Standard: der letzte abgeschlossene Monat
  const month = isMonthKey(params.monat) ? params.monat : shiftMonth(today.slice(0, 7), -1);

  const [report, goalDocs] = await Promise.all([
    getMonthReport(user.id, month, today),
    goalsCollection.find({ userId: user.id }).toArray(),
  ]);

  const name = monthName(month);
  const nav = (
    <div className="flex items-center gap-1">
      <Link aria-label="Vorheriger Monat" href={`?monat=${shiftMonth(month, -1)}`} className="rounded-sm p-2 text-ink-2 hover:bg-sunken">
        <CaretLeft size={16} />
      </Link>
      <span className="min-w-36 text-center text-[14px] font-medium">{formatMonth(month)}</span>
      {month < today.slice(0, 7) ? (
        <Link aria-label="Nächster Monat" href={`?monat=${shiftMonth(month, 1)}`} className="rounded-sm p-2 text-ink-2 hover:bg-sunken">
          <CaretRight size={16} />
        </Link>
      ) : (
        <span className="w-8" />
      )}
    </div>
  );

  if (report.incomeCents === 0 && report.expenseCents === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex justify-end">{nav}</div>
        <Empty title={`Für ${formatMonth(month)} gibt es keine Buchungen.`}>Sobald Buchungen vorliegen, entsteht hier automatisch der Bericht.</Empty>
      </div>
    );
  }

  const headline =
    report.netCents >= 0
      ? `Im ${name} ${report.complete ? "sind" : "sind bisher"} ${formatMoney(report.netCents, { whole: true })} übrig geblieben${report.savingsRate !== null ? ` – ${formatPercent(report.savingsRate)} deiner Einnahmen` : ""}.`
      : `Im ${name} hast du ${formatMoney(-report.netCents, { whole: true })} mehr ausgegeben als eingenommen.`;

  const expenseChange = changeRatio(report.expenseCents, report.previous.expenseCents);
  const top = report.categories[0];

  return (
    <article className="flex flex-col gap-12">
      <header className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-ink-3">
            Monatsbericht · {report.transactionCount} Buchungen{report.complete ? "" : " · Monat läuft noch"}
          </p>
          {nav}
        </div>
        <h1 className="max-w-3xl font-serif text-[32px] leading-[1.15] tracking-[-0.01em] sm:text-[40px]">{headline}</h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-ink-2">
          {expenseChange !== null
            ? `Ausgaben ${expenseChange > 0 ? "über" : "unter"} dem Vormonat (${formatPercent(expenseChange, { signed: true })}). `
            : ""}
          {top ? `Größter Posten war ${top.name} mit ${formatMoney(top.cents, { whole: true })} – ${formatPercent(top.share)} der Ausgaben. ` : ""}
          {report.fixedBookedCents > 0 ? `${formatMoney(report.fixedBookedCents, { whole: true })} davon waren Fixkosten.` : ""}
        </p>
      </header>

      <Figures
        items={[
          {
            label: "Einnahmen",
            value: <Money cents={report.incomeCents} />,
            note: <DeltaNote current={report.incomeCents} previous={report.previous.incomeCents} />,
          },
          {
            label: "Ausgaben",
            value: <Money cents={report.expenseCents} />,
            note: <DeltaNote current={report.expenseCents} previous={report.previous.expenseCents} invert />,
          },
          { label: "Saldo", value: <Money cents={report.netCents} tone="flow" />, note: `Vormonat ${formatMoney(report.previous.netCents, { signed: true, whole: true })}` },
          {
            label: "Sparquote",
            value: <span className="num">{report.savingsRate !== null ? formatPercent(report.savingsRate) : "–"}</span>,
            note: report.previous.savingsRate !== null ? `Vormonat ${formatPercent(report.previous.savingsRate)}` : undefined,
          },
        ]}
      />

      <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr]">
        <Section title="Wofür das Geld ging" description="Im Vergleich zum Durchschnitt der drei Vormonate">
          <ul>
            {report.categories.slice(0, 10).map((line) => (
              <li key={line.categoryId ?? "none"} className="grid grid-cols-[1fr_auto] gap-x-4 border-b border-line py-2.5 sm:grid-cols-[11rem_1fr_6rem_5rem]">
                <span className="flex items-center gap-2 text-[14px]">
                  <Swatch color={line.color} />
                  <span className="truncate">{line.name}</span>
                </span>
                <span className="relative col-span-2 row-start-2 mt-1 h-1.5 rounded-full bg-sunken sm:col-span-1 sm:row-start-auto sm:mt-2" aria-hidden>
                  <span className="absolute inset-y-0 left-0 rounded-full bg-ink" style={{ width: `${line.share * 100}%` }} />
                </span>
                <Money cents={line.cents} whole className="text-right text-[14px]" />
                <span className="hidden text-right text-[12px] sm:block">
                  {line.change !== null ? <Delta value={line.change} invert text={formatPercent(line.change, { signed: true })} /> : <span className="text-ink-3">neu</span>}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <div className="flex flex-col gap-12">
          <Section title="Auffällig">
            {report.anomalies.length === 0 ? (
              <p className="text-[14px] text-ink-3">Keine Kategorie weicht deutlich von deinem Durchschnitt ab.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {report.anomalies.map((a) => (
                  <li key={a.categoryId ?? "none"} className="text-[14px] leading-relaxed">
                    <span className="font-medium">{a.name}</span>{" "}
                    <span className="text-ink-2">
                      {a.direction === "new"
                        ? `– neu mit ${formatMoney(a.currentCents, { whole: true })}.`
                        : `lag ${formatPercent(Math.abs(a.changeRatio))} ${a.direction === "higher" ? "über" : "unter"} dem Durchschnitt (${formatMoney(a.currentCents, { whole: true })} statt Ø ${formatMoney(a.averageCents, { whole: true })}).`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Größte Einzelausgaben">
            <ul>
              {report.biggest.map((item) => (
                <li key={item.id} className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-[14px]">
                  <span className="min-w-0 truncate">
                    {item.title} <span className="text-[12px] text-ink-3">{formatDayShort(item.date)}</span>
                  </span>
                  <Money cents={-item.cents} />
                </li>
              ))}
            </ul>
          </Section>

          {report.wealth ? (
            <Section title="Kontostände">
              <p className="text-[14px] text-ink-2">
                Von <Money cents={report.wealth.startCents} whole /> auf <Money cents={report.wealth.endCents} whole className="font-medium text-ink" />{" "}
                <span className={cx("num", report.wealth.endCents >= report.wealth.startCents ? "text-pos" : "text-caution")}>
                  ({formatMoney(report.wealth.endCents - report.wealth.startCents, { signed: true, whole: true })})
                </span>
                , alle Konten inklusive Rücklagen.
              </p>
            </Section>
          ) : null}
        </div>
      </div>

      {report.incomeSources.length > 0 ? (
        <Section title="Woher das Geld kam">
          <ul className="flex flex-wrap gap-x-8 gap-y-2">
            {report.incomeSources.map((source) => (
              <li key={source.name} className="flex items-center gap-2 text-[14px]">
                <Swatch color={source.color} />
                {source.name} <Money cents={source.cents} whole className="text-ink-2" />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {goalDocs.length > 0 ? (
        <Section title="Ziele heute" aside={<Link href="/app/planung/ziele" className="text-ink-3 hover:text-ink">Zu den Zielen</Link>}>
          <ul className="grid gap-4 sm:grid-cols-2">
            {goalDocs.map((goal) => {
              const state = goalState({ targetCents: goal.targetCents, savedCents: goal.savedCents, deadline: goal.deadline ?? null, monthlyContributionCents: goal.monthlyContributionCents ?? null }, today);
              return (
                <li key={goal._id.toString()} className="flex flex-col gap-1.5">
                  <span className="flex justify-between text-[14px]">
                    <span>{goal.title}</span>
                    <span className="num text-ink-3">{formatPercent(state.progress)}</span>
                  </span>
                  <span className="relative h-1.5 rounded-full bg-sunken" aria-hidden>
                    <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${state.progress * 100}%`, background: goal.color }} />
                  </span>
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      <Note>Umbuchungen zwischen deinen Konten zählen weder als Einnahme noch als Ausgabe. Die Sparquote ist der Anteil der Einnahmen, der übrig bleibt.</Note>
    </article>
  );
}

function DeltaNote({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  const ratio = changeRatio(current, previous);
  if (ratio === null) return <>kein Vormonat</>;
  return (
    <>
      <Delta value={ratio} invert={invert} text={formatPercent(ratio, { signed: true })} /> ggü. Vormonat
    </>
  );
}
