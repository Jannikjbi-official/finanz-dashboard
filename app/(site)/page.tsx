import Link from "next/link";
import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { buildForecast } from "@/lib/domain/forecast";
import { addDays } from "@/lib/domain/calendar";
import { evaluateSafety } from "@/lib/domain/safety";
import { checkAffordability, VERDICT_LABEL, type AffordabilityResult } from "@/lib/domain/affordability";
import { formatDayShort, formatMoney } from "@/lib/format";
import { TimelineChart } from "@/ui/timeline-chart";
import { cx } from "@/ui/cx";
import { SafetyScale } from "@/ui/safety";
import { Money } from "@/ui/money";
import { buttonClass } from "@/ui/button";
import { WaitlistForm } from "@/features/site/waitlist-form";

export const metadata: Metadata = {
  title: { absolute: `${BRAND.name} – ${BRAND.tagline}` },
  description: BRAND.description,
};

/**
 * Beispielrechnung fuer die Startseite - mit der echten Prognose-Engine,
 * aber festen, klar als Beispiel gekennzeichneten Werten. So passen Grafik,
 * Einstufung und Kaufbeispiel garantiert zusammen.
 */
const EXAMPLE_TODAY = "2026-03-10";
const EXAMPLE_RESERVE = 900_00;

function example() {
  const input = {
    today: EXAMPLE_TODAY,
    openingBalanceCents: 1840_00,
    recurring: [
      { id: "g", title: "Gehalt", kind: "income" as const, amountCents: 2350_00, interval: "monthly" as const, startDate: "2026-01-28", nextDue: "2026-03-28", active: true },
      { id: "m", title: "Miete", kind: "expense" as const, amountCents: 780_00, interval: "monthly" as const, startDate: "2026-01-01", nextDue: "2026-04-01", active: true },
      { id: "v", title: "Versicherungen", kind: "expense" as const, amountCents: 96_00, interval: "monthly" as const, startDate: "2026-01-15", nextDue: "2026-03-15", active: true },
      { id: "h", title: "Handy & Internet", kind: "expense" as const, amountCents: 54_00, interval: "monthly" as const, startDate: "2026-01-05", nextDue: "2026-04-05", active: true },
    ],
    planned: [{ id: "k", title: "Kfz-Versicherung (jährlich)", kind: "expense" as const, amountCents: 420_00, dateFrom: "2026-04-01", dateTo: "2026-04-01", certainty: "fixed" as const }],
    goals: [{ id: "u", title: "Urlaub", monthlyContributionCents: 150_00, targetCents: 1500_00, savedCents: 300_00 }],
    variableMonthlyCents: 820_00,
    variableSpentThisMonthCents: 240_00,
  };

  const forecast = buildForecast({ ...input, horizonDays: 90 });
  const safety = evaluateSafety(forecast, { reserveCents: EXAMPLE_RESERVE, reserveSource: "custom" }, (c) => formatMoney(c), formatDayShort);
  const purchase = checkAffordability(input, { label: "Laptop", amountCents: 1499_00, date: EXAMPLE_TODAY }, EXAMPLE_RESERVE, input.goals);

  // Vergangenheit rueckwaerts: frueher war mehr da (Alltag), vor dem Gehalt weniger, vor der Miete mehr
  const past: Array<{ date: string; balanceCents: number }> = [];
  let balance = input.openingBalanceCents;
  for (let offset = 0; offset <= 40; offset += 1) {
    const date = addDays(EXAMPLE_TODAY, -offset);
    past.unshift({ date, balanceCents: balance });
    balance += 27_00;
    if (date === "2026-02-28") balance -= 2350_00;
    if (date === "2026-03-01" || date === "2026-02-01") balance += 780_00;
    if (date === "2026-02-15") balance += 96_00;
  }

  return { forecast, safety, purchase, past };
}

const VERDICT_TONE: Record<AffordabilityResult["verdict"], string> = {
  comfortable: "text-pos",
  possible: "text-accent",
  tight: "text-caution",
  "not-affordable": "text-neg",
};

export default function LandingPage() {
  const { forecast, safety, purchase, past } = example();

  return (
    <>
      {/* ------------------------------- Einstieg ------------------------------- */}
      <section className="mx-auto grid max-w-[1120px] gap-12 px-5 pb-16 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div className="flex flex-col justify-center">
          <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-accent">Kostenlos · im Aufbau</p>
          <h1 className="mt-4 font-serif text-[42px] leading-[1.05] tracking-[-0.015em] sm:text-[56px]">
            Weißt du, was du dir leisten kannst?
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-2">
            {BRAND.name} rechnet deine Finanzen 90 Tage voraus – aus Kontostand, Fixkosten und dem, was ansteht. Damit du vor einer
            Entscheidung weißt, was sie bedeutet. Nicht erst auf dem Kontoauszug.
          </p>
          <WaitlistForm className="mt-8 max-w-lg" />
          <p className="mt-4 text-[13px] text-ink-3">Keine Bankzugangsdaten. Kein Tracking. Keine Werbung.</p>
        </div>

        <figure className="flex flex-col justify-center border-t border-line pt-8 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[12px] text-ink-3">Verfügbar heute</p>
              <Money cents={forecast.openingBalanceCents} className="text-[34px] font-medium tracking-[-0.02em]" />
            </div>
            <SafetyScale level={safety.level} />
          </div>
          <TimelineChart
            className="mt-6"
            height={210}
            series={{ past, future: forecast.days.map((d) => ({ date: d.date, balanceCents: d.balanceCents })) }}
            events={forecast.events.map((e) => ({ date: e.date, amountCents: e.amountCents, label: e.label }))}
            reserveCents={EXAMPLE_RESERVE}
            ariaLabel="Beispielrechnung: Kontostand mit Prognose über 90 Tage und Mindestreserve"
          />
          <figcaption className="mt-3 text-[12px] leading-relaxed text-ink-3">
            Beispielrechnung. Am {formatDayShort(safety.low90.date)} erreicht der Stand mit {formatMoney(safety.low90.balanceCents, { whole: true })} seinen
            Tiefpunkt – noch {formatMoney(safety.low90.balanceCents - EXAMPLE_RESERVE, { whole: true })} über der Reserve. Das siehst du heute, nicht erst dann.
          </figcaption>
        </figure>
      </section>

      {/* --------------------------- Drei Fragen --------------------------- */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8">
          <h2 className="max-w-2xl font-serif text-[30px] leading-tight sm:text-[36px]">Drei Fragen, die ein Haushaltsbuch nicht beantwortet.</h2>
          <ol className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
            {[
              {
                n: "01",
                title: "Wie steht es gerade?",
                text: "Verfügbares Geld über alle Konten, dazu eine nachvollziehbare Einstufung von stabil bis unter Mindestreserve – mit dem Grund, warum.",
              },
              {
                n: "02",
                title: "Was kommt als Nächstes?",
                text: "Gehalt, Miete, Verträge, geplante Ausgaben und erwartete Erstattungen auf einer Zeitachse. Inklusive Tiefpunkt und Kalender.",
              },
              {
                n: "03",
                title: "Kann ich mir das leisten?",
                text: "Betrag eingeben, Wirkung sehen: Kontostand vorher und nachher, Reserve, Sparziele, und wie lange es dauert, bis der Betrag wieder drin ist.",
              },
            ].map((item) => (
              <li key={item.n} className="border-t border-ink pt-4">
                <p className="num text-[13px] text-ink-3">{item.n}</p>
                <h3 className="mt-2 text-[18px] font-semibold tracking-[-0.01em]">{item.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{item.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------ Kann ich mir das leisten ------------------------ */}
      <section className="mx-auto grid max-w-[1120px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-accent">Entscheiden</p>
          <h2 className="mt-3 font-serif text-[30px] leading-tight sm:text-[36px]">Vor dem Kauf wissen, was er bedeutet.</h2>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-ink-2">
            Ein Laptop für 1.499 €, ein Umzug, eine neue Versicherung: Die Rechnung läuft gegen deine echte Prognose – nicht gegen
            eine Faustregel. In der Sandbox spielst du ganze Szenarien durch, ohne dass sich an deinen Daten etwas ändert.
          </p>
          <Link href="/funktionen#entscheiden" className="mt-6 inline-block text-[15px] font-medium text-accent hover:underline">
            Wie die Rechnung funktioniert →
          </Link>
        </div>
        <div className="border border-line bg-surface p-6 sm:p-8">
          <p className="text-[12px] text-ink-3">Beispiel · Laptop, 1.499 €, heute</p>
          <p className={cx("mt-2 text-[14px] font-semibold", VERDICT_TONE[purchase.verdict])}>{VERDICT_LABEL[purchase.verdict]}</p>
          <table className="mt-5 w-full text-[14px]">
            <thead>
              <tr className="text-left text-[12px] text-ink-3">
                <th className="pb-2 font-medium" />
                <th className="pb-2 text-right font-medium">ohne</th>
                <th className="pb-2 text-right font-medium">mit Kauf</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Stand Ende heute", purchase.before.onDateCents, purchase.after.onDateCents],
                ["Tiefster Stand", purchase.before.lowest.balanceCents, purchase.after.lowest.balanceCents],
                ["in 90 Tagen", purchase.before.in90Cents, purchase.after.in90Cents],
              ].map(([label, before, after]) => (
                <tr key={label as string} className="border-t border-line">
                  <td className="py-2.5">{label}</td>
                  <td className="py-2.5 text-right text-ink-2">
                    <Money cents={before as number} whole />
                  </td>
                  <td className="py-2.5 text-right font-medium">
                    <Money cents={after as number} whole className={(after as number) < EXAMPLE_RESERVE ? "text-caution" : undefined} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-5 text-[13px] leading-relaxed text-ink-2">
            Frei über der Reserve von {formatMoney(EXAMPLE_RESERVE, { whole: true })} wären {formatMoney(purchase.headroomCents, { whole: true })}.
            {purchase.recovery ? ` Bei ${formatMoney(purchase.monthlySurplusCents, { whole: true })} Überschuss im Monat wäre der Betrag in etwa ${purchase.recovery.months} Monaten wieder drin.` : ""}
            {purchase.goalImpacts[0]?.delayMonths ? ` Das Urlaubsziel verschiebt sich um rund ${purchase.goalImpacts[0].delayMonths} Monate, wenn die Lücke aus der Sparrate kommt.` : ""}
          </p>
        </div>
      </section>

      {/* --------------------------- Transparenz --------------------------- */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-[1120px] gap-12 px-5 py-16 sm:px-8 lg:grid-cols-2">
          <div>
            <h2 className="font-serif text-[30px] leading-tight sm:text-[34px]">Keine Blackbox. Jede Zahl erklärt sich.</h2>
            <p className="mt-4 max-w-md text-[16px] leading-relaxed text-ink-2">
              Die Sicherheitszone folgt vier festen Regeln, die du nachlesen kannst. Die Prognose rechnet vorsichtig: Ausgaben so früh
              wie möglich, erwartete Einnahmen so spät wie möglich, Einnahmen ohne Termin gar nicht.
            </p>
          </div>
          <dl className="grid gap-4 text-[14px]">
            {[
              ["stable", "Stabil", "In 90 Tagen bleibt dein Stand über der Mindestreserve."],
              ["tight", "Angespannt", "Er fällt in 31–90 Tagen darunter, oder der Puffer der nächsten 30 Tage ist dünn."],
              ["critical", "Kritisch", "Er fällt in den nächsten 30 Tagen unter die Reserve."],
              ["below", "Unter Mindestreserve", "Dein verfügbares Geld liegt schon heute darunter."],
            ].map(([level, label, text]) => (
              <div key={level} className="grid grid-cols-[10.5rem_1fr] items-baseline gap-4 border-t border-line pt-4">
                <dt>
                  <SafetyScale level={level as "stable"} className="[&>span]:text-[13px]" />
                </dt>
                <dd className="text-ink-2">
                  <span className="sr-only">{label}: </span>
                  {text}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ------------------------------ Daten ------------------------------ */}
      <section className="mx-auto grid max-w-[1120px] gap-10 px-5 py-20 sm:px-8 md:grid-cols-3">
        {[
          { title: "Ohne Bankzugang", text: "Du trägst ein oder importierst eine CSV aus deinem Online-Banking. Zugangsdaten zu deiner Bank brauchen wir nie." },
          { title: "Deine Daten bleiben deine", text: "Kein Tracking, keine Werbung, kein Verkauf. Vollständiger Export als CSV oder JSON und Löschung mit einem Klick." },
          { title: "Planung, keine Beratung", text: "Wir rechnen mit deinen Zahlen und zeigen Folgen. Wir empfehlen keine Produkte und verdienen nicht an deinen Entscheidungen." },
        ].map((item) => (
          <div key={item.title} className="border-t border-ink pt-4">
            <h3 className="text-[17px] font-semibold">{item.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{item.text}</p>
          </div>
        ))}
      </section>

      {/* ------------------------------ Schluss ------------------------------ */}
      <section className="border-t border-line bg-ink text-paper">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-8 px-5 py-16 sm:px-8 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-serif text-[32px] leading-tight">Gerade im Aufbau.</h2>
            <p className="mt-3 max-w-md text-[16px] leading-relaxed opacity-80">
              {BRAND.name} startet als geschlossene Beta. Trag dich ein – wir melden uns, sobald ein Platz frei ist.
            </p>
          </div>
          <Link href="/warteliste" className={buttonClass("secondary", "md", "h-11 border-paper/40 bg-transparent px-5 text-paper hover:border-paper")}>
            Auf die Warteliste
          </Link>
        </div>
      </section>
    </>
  );
}
