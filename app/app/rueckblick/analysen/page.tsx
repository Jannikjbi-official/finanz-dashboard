import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/server/user-data";
import { getAnalysis } from "@/lib/server/reports";
import { todayIn } from "@/lib/domain/calendar";
import { formatMoney, formatMonth, formatPercent } from "@/lib/format";
import { Empty, Figures, Note, PageHeader, Section, Swatch } from "@/ui/layout";
import { Delta, Money } from "@/ui/money";
import { cx } from "@/ui/cx";

export const metadata = { title: "Analysen" };

export default async function AnalysenPage() {
  const user = await requireUser();
  const settings = await getSettings(user.id);
  const today = todayIn(settings.timeZone);
  const analysis = await getAnalysis(user.id, today.slice(0, 7));

  const withData = analysis.months.filter((m) => m.incomeCents > 0 || m.expenseCents > 0);
  if (withData.length === 0) {
    return (
      <>
        <PageHeader title="Analysen" />
        <Empty title="Noch zu wenig Daten.">Analysen entstehen, sobald Buchungen aus mehreren Monaten vorliegen.</Empty>
      </>
    );
  }

  // Laufender Monat ist unvollstaendig und zaehlt nicht in die Durchschnitte
  const complete = withData.filter((m) => m.month !== today.slice(0, 7));
  const avg = (pick: (m: (typeof withData)[number]) => number) =>
    complete.length ? Math.round(complete.reduce((s, m) => s + pick(m), 0) / complete.length) : 0;
  const avgIncome = avg((m) => m.incomeCents);
  const avgExpense = avg((m) => m.expenseCents);
  const totalNet = withData.reduce((s, m) => s + m.netCents, 0);
  const max = Math.max(...analysis.months.map((m) => Math.max(m.incomeCents, m.expenseCents)), 1);

  return (
    <div className="flex flex-col gap-12">
      <PageHeader title="Analysen" description="Die letzten zwölf Monate: wie sich Einnahmen, Ausgaben und Kategorien entwickeln." />

      <Figures
        items={[
          { label: "Ø Einnahmen", value: <Money cents={avgIncome} whole />, note: `über ${complete.length} volle Monate` },
          { label: "Ø Ausgaben", value: <Money cents={avgExpense} whole /> },
          { label: "Ø übrig pro Monat", value: <Money cents={avgIncome - avgExpense} whole tone="flow" /> },
          { label: "Summe 12 Monate", value: <Money cents={totalNet} whole tone="flow" />, note: "Einnahmen minus Ausgaben" },
        ]}
      />

      <Section
        title="Einnahmen und Ausgaben"
        aside={
          <span className="flex gap-4 text-[12px] text-ink-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-1.5 bg-pos" /> Einnahmen
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-1.5 bg-ink" /> Ausgaben
            </span>
          </span>
        }
      >
        <div className="grid grid-cols-12 items-end gap-1 sm:gap-2" style={{ height: 200 }} role="img" aria-label="Einnahmen und Ausgaben der letzten zwölf Monate">
          {analysis.months.map((m) => (
            <div key={m.month} className="flex h-full items-end justify-center gap-[2px]" title={`${formatMonth(m.month)}: +${formatMoney(m.incomeCents)} / −${formatMoney(m.expenseCents)}`}>
              <span className="w-1/3 max-w-3 bg-pos" style={{ height: `${(m.incomeCents / max) * 100}%` }} />
              <span className={cx("w-1/3 max-w-3", m.month === today.slice(0, 7) ? "bg-ink-3" : "bg-ink")} style={{ height: `${(m.expenseCents / max) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-12 gap-1 border-t border-line pt-2 sm:gap-2">
          {analysis.months.map((m) => (
            <div key={m.month} className="flex flex-col items-center gap-0.5 text-center">
              <span className="text-[11px] text-ink-3">{formatMonth(m.month, { short: true }).split(" ")[0]}</span>
              <span className={cx("num hidden text-[11px] sm:block", m.netCents >= 0 ? "text-pos" : "text-caution")}>
                {m.incomeCents || m.expenseCents ? formatMoney(m.netCents, { signed: true, whole: true }).replace(/\s?€/, "") : ""}
              </span>
              <span className="num hidden text-[10px] text-ink-3 md:block">{m.savingsRate !== null ? formatPercent(m.savingsRate) : ""}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-ink-3">Unter den Monaten: übrig in Euro und Sparquote. Der laufende Monat ist grau.</p>
      </Section>

      <Section title="Kategorien im Verlauf" description="Ausgaben der letzten sechs Monate; Trend vergleicht die letzten drei mit den drei davor">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-ink-3">
                <th className="py-2 pr-3 font-medium">Kategorie</th>
                {analysis.recentMonths.map((m) => (
                  <th key={m} className="py-2 pr-3 text-right font-medium">
                    {formatMonth(m, { short: true }).split(" ")[0]}
                  </th>
                ))}
                <th className="py-2 pr-3 text-right font-medium">Ø</th>
                <th className="py-2 text-right font-medium">Trend</th>
              </tr>
            </thead>
            <tbody>
              {analysis.categories.map((row) => {
                const rowMax = Math.max(...row.values, 1);
                return (
                  <tr key={row.categoryId ?? "none"} className="border-b border-line">
                    <td className="py-2.5 pr-3">
                      <span className="flex items-center gap-2">
                        <Swatch color={row.color} />
                        <span className="truncate">{row.name}</span>
                      </span>
                    </td>
                    {row.values.map((value, index) => (
                      <td key={index} className="relative py-2.5 pr-3 text-right">
                        <span className="absolute bottom-1 right-3 h-[2px] bg-ink/25" style={{ width: `${(value / rowMax) * 70}%` }} aria-hidden />
                        <span className={cx("num", value === 0 && "text-ink-3")}>{value ? formatMoney(value, { whole: true }).replace(/\s?€/, "") : "–"}</span>
                      </td>
                    ))}
                    <td className="num py-2.5 pr-3 text-right font-medium">{formatMoney(row.average, { whole: true })}</td>
                    <td className="py-2.5 text-right">{row.trend !== null ? <Delta value={row.trend} invert text={formatPercent(row.trend, { signed: true })} /> : <span className="text-ink-3">–</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Note>Alle Werte ohne Umbuchungen. Durchschnitte nur über volle Monate mit Buchungen.</Note>
    </div>
  );
}
