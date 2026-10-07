import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/server/user-data";
import { getAccountBalances } from "@/lib/server/finance";
import { getMonthReport } from "@/lib/server/reports";
import { addMonths, isISODate, monthOf, shiftMonth, todayIn } from "@/lib/domain/calendar";
import { formatDateLong, formatMoney, formatMonth, formatPercent } from "@/lib/format";
import { Empty, Note, Section, Swatch } from "@/ui/layout";
import { Money } from "@/ui/money";
import { buttonClass } from "@/ui/button";
import { cx } from "@/ui/cx";

export const metadata = { title: "Zeitreise" };

const PRESETS = [1, 3, 6, 12, 24];

export default async function ZeitreisePage({ searchParams }: { searchParams: Promise<{ datum?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const settings = await getSettings(user.id);
  const today = todayIn(settings.timeZone);
  const date = params.datum && isISODate(params.datum) && params.datum < today ? params.datum : addMonths(today, -6);

  const thenMonth = monthOf(date);
  const lastFull = shiftMonth(today.slice(0, 7), -1);

  const [then, now, reportThen, reportNow] = await Promise.all([
    getAccountBalances(user.id, date),
    getAccountBalances(user.id, today),
    getMonthReport(user.id, thenMonth, today),
    getMonthReport(user.id, lastFull, today),
  ]);

  const liquid = (list: typeof now) => list.filter((a) => a.liquid && !a.archived).reduce((s, a) => s + a.balanceCents, 0);
  const total = (list: typeof now) => list.filter((a) => !a.archived).reduce((s, a) => s + a.balanceCents, 0);

  const comparison: Array<{ label: string; then: number | null; now: number | null; percent?: boolean }> = [
    { label: "Einnahmen im Monat", then: reportThen.incomeCents, now: reportNow.incomeCents },
    { label: "Ausgaben im Monat", then: reportThen.expenseCents, now: reportNow.expenseCents },
    { label: "Übrig", then: reportThen.netCents, now: reportNow.netCents },
    {
      label: "Sparquote",
      then: reportThen.savingsRate === null ? null : Math.round(reportThen.savingsRate * 1000),
      now: reportNow.savingsRate === null ? null : Math.round(reportNow.savingsRate * 1000),
      percent: true,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-5">
        <p className="text-[13px] text-ink-3">Zeitreise</p>
        <h1 className="max-w-3xl font-serif text-[32px] leading-[1.15] tracking-[-0.01em] sm:text-[40px]">
          So stand es am {formatDateLong(date)}.
        </h1>
        <form method="get" className="flex flex-wrap items-center gap-2">
          {PRESETS.map((months) => {
            const target = addMonths(today, -months);
            return (
              <Link key={months} href={`?datum=${target}`} className={cx(buttonClass(target === date ? "primary" : "secondary", "sm"))}>
                vor {months} {months === 1 ? "Monat" : "Monaten"}
              </Link>
            );
          })}
          <input
            type="date"
            name="datum"
            defaultValue={date}
            max={today}
            aria-label="Eigenes Datum"
            className="num h-8 rounded-sm border border-line-strong bg-surface px-2 text-[13px]"
          />
          <button type="submit" className={buttonClass("ghost", "sm")}>
            Anzeigen
          </button>
        </form>
      </header>

      {now.length > 0 ? (
        <Section title="Kontostände – damals und heute">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-[14px]">
              <thead>
                <tr className="text-left text-[12px] text-ink-3">
                  <th className="py-2 pr-3 font-medium">Konto</th>
                  <th className="py-2 pr-3 text-right font-medium">{formatDateLong(date)}</th>
                  <th className="py-2 pr-3 text-right font-medium">heute</th>
                  <th className="py-2 text-right font-medium">Veränderung</th>
                </tr>
              </thead>
              <tbody>
                {now
                  .filter((a) => !a.archived)
                  .map((account) => {
                    const past = then.find((a) => a.id === account.id)?.balanceCents ?? 0;
                    return (
                      <tr key={account.id} className="border-t border-line">
                        <td className="py-2.5 pr-3">
                          <span className="flex items-center gap-2">
                            <Swatch color={account.color} />
                            {account.name}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-right text-ink-2">
                          <Money cents={past} />
                        </td>
                        <td className="py-2.5 pr-3 text-right">
                          <Money cents={account.balanceCents} />
                        </td>
                        <td className={cx("num py-2.5 text-right", account.balanceCents - past >= 0 ? "text-pos" : "text-caution")}>
                          {formatMoney(account.balanceCents - past, { signed: true })}
                        </td>
                      </tr>
                    );
                  })}
                <tr className="border-t border-line font-medium">
                  <td className="py-2.5 pr-3">Verfügbar</td>
                  <td className="py-2.5 pr-3 text-right"><Money cents={liquid(then)} /></td>
                  <td className="py-2.5 pr-3 text-right"><Money cents={liquid(now)} /></td>
                  <td className={cx("num py-2.5 text-right", liquid(now) - liquid(then) >= 0 ? "text-pos" : "text-caution")}>
                    {formatMoney(liquid(now) - liquid(then), { signed: true })}
                  </td>
                </tr>
                <tr className="border-t border-line text-ink-2">
                  <td className="py-2.5 pr-3">Alle Konten</td>
                  <td className="py-2.5 pr-3 text-right"><Money cents={total(then)} /></td>
                  <td className="py-2.5 pr-3 text-right"><Money cents={total(now)} /></td>
                  <td className="num py-2.5 text-right">{formatMoney(total(now) - total(then), { signed: true })}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>
      ) : (
        <Empty title="Ohne Konten keine Kontostände.">Lege Konten an, dann zeigt die Zeitreise, wie sich jedes einzelne entwickelt hat.</Empty>
      )}

      <Section title={`${formatMonth(thenMonth)} im Vergleich zu ${formatMonth(lastFull)}`}>
        <table className="w-full text-[14px]">
          <thead>
            <tr className="text-left text-[12px] text-ink-3">
              <th className="py-2 pr-3 font-medium" />
              <th className="py-2 pr-3 text-right font-medium">{formatMonth(thenMonth, { short: true })}</th>
              <th className="py-2 text-right font-medium">{formatMonth(lastFull, { short: true })}</th>
            </tr>
          </thead>
          <tbody>
            {comparison.map((row) => (
              <tr key={row.label} className="border-t border-line">
                <td className="py-2.5 pr-3">{row.label}</td>
                <td className="py-2.5 pr-3 text-right text-ink-2">
                  {row.then === null ? "–" : row.percent ? <span className="num">{formatPercent(row.then / 1000)}</span> : <Money cents={row.then} whole />}
                </td>
                <td className="py-2.5 text-right">
                  {row.now === null ? "–" : row.percent ? <span className="num">{formatPercent(row.now / 1000)}</span> : <Money cents={row.now} whole />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          { title: `Ausgaben ${formatMonth(thenMonth)}`, report: reportThen },
          { title: `Ausgaben ${formatMonth(lastFull)}`, report: reportNow },
        ].map(({ title, report }) => (
          <Section key={title} title={title}>
            {report.categories.length === 0 ? (
              <p className="text-[14px] text-ink-3">Keine Ausgaben erfasst.</p>
            ) : (
              <ul>
                {report.categories.slice(0, 6).map((line) => (
                  <li key={line.categoryId ?? "none"} className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-[14px]">
                    <span className="flex items-center gap-2">
                      <Swatch color={line.color} />
                      {line.name}
                    </span>
                    <span className="flex items-baseline gap-3">
                      <span className="num text-[12px] text-ink-3">{formatPercent(line.share)}</span>
                      <Money cents={line.cents} whole />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        ))}
      </div>

      <Note>
        Kontostände werden aus Startsaldo und allen Buchungen bis zum Stichtag rekonstruiert. Fixkosten und Ziele werden nicht historisch
        gespeichert – die Zeitreise zeigt deshalb, was sich aus den Buchungen ergibt.
      </Note>
    </div>
  );
}
