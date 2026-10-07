import Link from "next/link";
import { requireUser } from "@/lib/session";
import { loadFinancialPicture } from "@/lib/server/finance";
import { checkAffordability, VERDICT_LABEL, type AffordabilityResult } from "@/lib/domain/affordability";
import { buildForecast } from "@/lib/domain/forecast";
import { purchaseEvents } from "@/lib/domain/affordability";
import { isISODate } from "@/lib/domain/calendar";
import { parseAmountToCents } from "@/lib/money";
import { formatDayShort, formatMoney, formatMonth } from "@/lib/format";
import { PageHeader, Note, Section } from "@/ui/layout";
import { Money } from "@/ui/money";
import { TimelineChart } from "@/ui/timeline-chart";
import { cx } from "@/ui/cx";
import { buttonClass } from "@/ui/button";

export const metadata = { title: "Kann ich mir das leisten?" };

type Search = { was?: string; betrag?: string; datum?: string; raten?: string };

const VERDICT_TONE: Record<AffordabilityResult["verdict"], string> = {
  comfortable: "text-pos",
  possible: "text-accent",
  tight: "text-caution",
  "not-affordable": "text-neg",
};

const input =
  "h-11 w-full rounded-sm border border-line-strong bg-surface px-3 text-[15px] text-ink placeholder:text-ink-3 hover:border-ink-3 focus:border-accent focus:outline-none";

export default async function KaufcheckPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const params = await searchParams;
  const picture = await loadFinancialPicture(user.id, { horizonDays: 90 });
  const { today } = picture;

  const label = (params.was ?? "").trim().slice(0, 60) || "Kauf";
  const amountCents = params.betrag ? parseAmountToCents(params.betrag) : null;
  const date = params.datum && isISODate(params.datum) && params.datum >= today ? params.datum : today;
  const installments = Math.min(48, Math.max(1, Number(params.raten) || 1));
  const asked = amountCents !== null && amountCents > 0;

  const result = asked
    ? checkAffordability(
        picture.forecastInput,
        { label, amountCents: amountCents!, date, installments },
        picture.safety.reserveCents,
        picture.goals,
      )
    : null;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Kann ich mir das leisten?"
        description="Rechnet einen Kauf gegen deine Prognose: Kontostand, Fixkosten, Geplantes, Sparziele und Reserve. Eine Liquiditätsrechnung – keine Finanzberatung."
      />

      <form method="get" className="grid gap-3 border-y border-line py-5 sm:grid-cols-[1.4fr_1fr_1fr_8rem_auto] sm:items-end">
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
          Was?
          <input name="was" defaultValue={params.was ?? ""} placeholder="z. B. Laptop" maxLength={60} className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
          Wie viel?
          <span className="relative">
            <input name="betrag" defaultValue={params.betrag ?? ""} required inputMode="decimal" placeholder="1.499" className={cx(input, "num pr-8 text-right")} />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3">€</span>
          </span>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
          Wann?
          <input type="date" name="datum" defaultValue={date} min={today} className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
          Raten
          <select name="raten" defaultValue={String(installments)} className={input}>
            {[1, 3, 6, 10, 12, 24].map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "auf einmal" : `${n} Monate`}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonClass("primary", "md", "h-11")}>
          Durchrechnen
        </button>
      </form>

      {!result ? (
        <Intro headroomCents={picture.safety.headroomCents} reserveCents={picture.safety.reserveCents} />
      ) : (
        <Result result={result} picture={picture} />
      )}
    </div>
  );
}

function Intro({ headroomCents, reserveCents }: { headroomCents: number; reserveCents: number }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <div>
        <p className="text-[13px] text-ink-3">Dein Spielraum heute</p>
        <Money cents={headroomCents} whole className="mt-1 block text-[40px] font-medium leading-none tracking-[-0.03em]" />
        <p className="mt-3 max-w-md text-[14px] leading-relaxed text-ink-2">
          So viel ist frei, ohne dass dein Stand in den nächsten 90 Tagen unter die Reserve von {formatMoney(reserveCents, { whole: true })} fällt.
          Darunter wird es eng, darüber hinaus gehst du an die Reserve.
        </p>
      </div>
      <div className="flex flex-col gap-2 text-[14px] text-ink-2">
        <p className="font-medium text-ink">Was die Rechnung berücksichtigt</p>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>dein verfügbares Geld heute</li>
          <li>Fixkosten und festes Einkommen mit ihren echten Terminen</li>
          <li>geplante Ausgaben und erwartete Einnahmen (vorsichtig gerechnet)</li>
          <li>Sparraten deiner Ziele</li>
          <li>deine üblichen variablen Ausgaben</li>
          <li>deine Mindestreserve</li>
        </ul>
      </div>
    </div>
  );
}

function headline(result: AffordabilityResult) {
  const amount = formatMoney(result.purchase.amountCents, { whole: true });
  switch (result.verdict) {
    case "comfortable":
      return `${amount} für „${result.purchase.label}“ sind gut gedeckt.`;
    case "possible":
      return `${amount} gehen – danach ist der Puffer aber dünn.`;
    case "tight":
      return `${amount} würden an deine Reserve gehen.`;
    case "not-affordable":
      return `${amount} sind mit deinem Geld nicht gedeckt.`;
  }
}

function Result({ result, picture }: { result: AffordabilityResult; picture: Awaited<ReturnType<typeof loadFinancialPicture>> }) {
  const span = Math.max(90, result.horizonDays);
  const base = buildForecast({ ...picture.forecastInput, horizonDays: span });
  const after = buildForecast({ ...picture.forecastInput, horizonDays: span, extraEvents: purchaseEvents(result.purchase) });
  const reserve = result.reserveCents;

  const rows: Array<{ label: string; before: number; after: number; note?: string }> = [
    { label: `Stand Ende ${formatDayShort(result.purchase.date)}`, before: result.before.onDateCents, after: result.after.onDateCents },
    { label: "in 30 Tagen", before: result.before.in30Cents, after: result.after.in30Cents },
    { label: "in 90 Tagen", before: result.before.in90Cents, after: result.after.in90Cents },
    {
      label: "Tiefster Stand",
      before: result.before.lowest.balanceCents,
      after: result.after.lowest.balanceCents,
      note: `am ${formatDayShort(result.after.lowest.date)}`,
    },
    { label: "Abstand zur Reserve", before: result.before.lowest.balanceCents - reserve, after: result.after.lowest.balanceCents - reserve },
  ];

  return (
    <div className="flex flex-col gap-10">
      <section>
        <p className={cx("text-[14px] font-semibold", VERDICT_TONE[result.verdict])}>{VERDICT_LABEL[result.verdict]}</p>
        <h2 className="mt-1 max-w-3xl font-serif text-[30px] leading-[1.15] tracking-[-0.01em] sm:text-[36px]">{headline(result)}</h2>
        <ul className="mt-4 flex max-w-3xl flex-col gap-1.5 text-[15px] leading-relaxed text-ink-2">
          {result.overdraft ? (
            <li>
              Am {formatDayShort(result.overdraft.date)} wärst du mit <span className="num text-neg">{formatMoney(result.overdraft.balanceCents)}</span> im Minus.
            </li>
          ) : null}
          {result.reserveBreach && !result.overdraft ? (
            <li>
              Ab dem {formatDayShort(result.reserveBreach.date)} läge dein Stand unter der Reserve von {formatMoney(reserve, { whole: true })}.
            </li>
          ) : null}
          <li>
            Frei über der Reserve sind heute <span className="num">{formatMoney(result.headroomCents, { whole: true })}</span>
            {result.gapCents > 0 ? (
              <>
                {" "}– es fehlen <span className="num font-medium text-ink">{formatMoney(result.gapCents, { whole: true })}</span>.
              </>
            ) : (
              <> – der Kauf passt hinein.</>
            )}
          </li>
          <li>
            {result.recovery
              ? `Bei durchschnittlich ${formatMoney(result.monthlySurplusCents, { whole: true })} Überschuss im Monat ist der Betrag in etwa ${result.recovery.months} ${result.recovery.months === 1 ? "Monat" : "Monaten"} wieder hereingeholt (${formatMonth(result.recovery.month)}).`
              : "Deine Prognose zeigt keinen monatlichen Überschuss – ohne Änderungen holst du den Betrag nicht wieder herein."}
          </li>
        </ul>
      </section>

      <Section title="Vorher und nachher">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-[14px]">
            <thead>
              <tr className="text-left text-[12px] text-ink-3">
                <th className="py-2 pr-3 font-medium" />
                <th className="py-2 pr-3 text-right font-medium">ohne Kauf</th>
                <th className="py-2 pr-3 text-right font-medium">mit Kauf</th>
                <th className="py-2 text-right font-medium">Unterschied</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-t border-line">
                  <td className="py-2.5 pr-3">
                    {row.label}
                    {row.note ? <span className="ml-2 text-[12px] text-ink-3">{row.note}</span> : null}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-ink-2">
                    <Money cents={row.before} />
                  </td>
                  <td className={cx("py-2.5 pr-3 text-right font-medium", row.after < 0 ? "text-neg" : row.after < reserve && row.label !== "Abstand zur Reserve" ? "text-caution" : undefined)}>
                    <Money cents={row.after} />
                  </td>
                  <td className="py-2.5 text-right text-ink-3">
                    <Money cents={row.after - row.before} signed />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <TimelineChart
          className="mt-8"
          height={200}
          series={{
            past: [{ date: picture.today, balanceCents: picture.openingBalanceCents }],
            future: after.days.map((d) => ({ date: d.date, balanceCents: d.balanceCents })),
            compare: base.days.map((d) => ({ date: d.date, balanceCents: d.balanceCents })),
            futureLabel: "mit Kauf",
            compareLabel: "ohne Kauf",
          }}
          events={after.events.map((e) => ({ date: e.date, amountCents: e.amountCents, label: e.label }))}
          reserveCents={reserve}
          ariaLabel={`Prognose mit und ohne Kauf über ${span} Tage`}
        />
      </Section>

      <Section title="Auswirkung auf deine Ziele">
        {result.goalImpacts.length === 0 ? (
          <p className="text-[14px] text-ink-3">
            Keine Ziele mit Sparrate.{" "}
            <Link href="/app/planung/ziele" className="text-accent hover:underline">
              Ziel anlegen
            </Link>
          </p>
        ) : (
          <ul className="border-t border-line">
            {result.goalImpacts.map((impact) => (
              <li key={impact.goalId} className="flex items-baseline justify-between gap-4 border-b border-line py-3 text-[14px]">
                <span>{impact.title}</span>
                <span className={cx(impact.delayMonths ? "text-caution" : "text-ink-3")}>
                  {impact.delayMonths === 0
                    ? "keine Verzögerung"
                    : impact.delayMonths === null
                      ? "–"
                      : `etwa ${impact.delayMonths} ${impact.delayMonths === 1 ? "Monat" : "Monate"} später, wenn die Lücke aus der Sparrate kommt`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Note>
        So wird gerechnet: Die Prognose wird zweimal erstellt – einmal ohne, einmal mit dem Kauf (bei Raten verteilt auf die Monate).
        Verglichen werden Kontostand, tiefster Punkt und Abstand zur Mindestreserve. Fehlt Geld über der Reserve, zeigt die
        Zielauswirkung, wie lange die Sparrate ausfallen müsste, um die Lücke zu schließen. Die Rechnung kennt nur, was du eingetragen
        hast; sie ist keine Anlage- oder Finanzberatung.
      </Note>

      <div>
        <Link href={`/app/entscheiden/sandbox?betrag=${result.purchase.amountCents}&was=${encodeURIComponent(result.purchase.label)}&datum=${result.purchase.date}`} className={buttonClass("secondary")}>
          In der Sandbox weiterspielen
        </Link>
      </div>
    </div>
  );
}
