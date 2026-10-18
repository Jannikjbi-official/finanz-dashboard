import type { Icon } from "@phosphor-icons/react";
import { ArrowCounterClockwise, ArrowsClockwise, Gift, Lightning, LinkSimple, LockKey } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { SiteInstall } from "@/components/shell/install-app";
import { LinkButton } from "@/components/site/site-links";
import { Figures, Money } from "@/components/ui/money";
import { availability } from "@/lib/domain/overview";
import type { Account, Recurring, Transaction } from "@/lib/domain/types";
import { formatDayShort, formatMoney } from "@/lib/format";
import { registrationOpen } from "@/lib/server/access";
import { getCurrentUser } from "@/lib/server/session";

export const metadata: Metadata = {
  title: { absolute: "Jannikjbi Finanzen – Wie viel ist wirklich verfügbar?" },
  description: "Private Finanzverwaltung: Kontostand minus alles, was schon feststeht – mit Abos, festen Kosten und Wunschliste.",
};

export const dynamic = "force-dynamic";

/**
 * Beispielrechnung mit der echten Logik (lib/domain/overview.ts) und festen,
 * klar gekennzeichneten Werten - so passt jede Zahl zur App.
 */
const EXAMPLE_TODAY = "2026-10-14";

function example() {
  const account: Account = { id: "giro", name: "Girokonto", kind: "giro", startBalanceCents: 0, balanceAnchor: { date: EXAMPLE_TODAY, amountCents: 1240_00 }, liquid: true, archived: false };
  const base = { note: null, categoryId: null, accountId: "giro", transferGroupId: null, recurringId: null, recurringDue: null };
  const transactions: Transaction[] = [
    { ...base, id: "v", type: "expense", status: "pending", bankPending: true, amountCents: 86_40, date: "2026-10-13", title: "Kartenzahlungen" },
    { ...base, id: "k", type: "expense", status: "pending", amountCents: 89_90, date: "2026-10-24", title: "Kopfhörer (Wunsch, eingeplant)" },
  ];
  const monthly = (id: string, title: string, type: "income" | "expense", amountCents: number, nextDue: string): Recurring => ({
    id, type, title, provider: null, amountCents, interval: "monthly", startDate: nextDue, nextDue, status: "active",
    costType: type === "expense" ? "subscription" : "other", categoryId: null, accountId: "giro", endDate: null, cancelledOn: null, noticePeriod: null, note: null,
  });
  const recurring = [
    monthly("h", "Handyvertrag", "expense", 19_99, "2026-10-12"),
    monthly("s", "Musikstreaming", "expense", 10_99, "2026-10-20"),
    monthly("m", "Miete", "expense", 520_00, "2026-11-01"),
    monthly("g", "Gehalt", "income", 1850_00, "2026-10-30"),
  ];
  return availability({ accounts: [account], transactions, recurring, today: EXAMPLE_TODAY });
}

const FEATURES: Array<{ icon: Icon; title: string; text: string }> = [
  {
    icon: LinkSimple,
    title: "Kontoauszug als CSV",
    text: "Gebucht, vorgemerkt und geplant werden unterschieden, Umbuchungen zwischen eigenen Konten zählen nie als Einnahme. Jeder Import lässt sich vollständig rückgängig machen.",
  },
  {
    icon: ArrowsClockwise,
    title: "Abos und feste Kosten",
    text: "Monats- und Jahreswerte, nächste Abbuchung, Kündigungsfristen. Kommt die Zahlung per Import, wird sie dem Termin zugeordnet – nichts zählt doppelt.",
  },
  {
    icon: Gift,
    title: "Wunschliste",
    text: "Was du kaufen willst, mit Preis, Termin und Sparziel. Ein Wunsch ändert keine Zahl – erst eingeplant zählt er in „Aktuell verfügbar“.",
  },
  {
    icon: Lightning,
    title: "Schnell erfassen",
    text: "„-12,50 Lidl gestern“ in eine Zeile tippen, Enter. Regeln ordnen Kategorien automatisch zu.",
  },
  {
    icon: ArrowCounterClockwise,
    title: "Nichts geht verloren",
    text: "Kontostand mit Datum abgleichen, Importe rückgängig machen, vollständige Sicherung als JSON – deine Zahlen bleiben nachvollziehbar.",
  },
  {
    icon: LockKey,
    title: "Privat",
    text: "Zugang nur für freigegebene Adressen, Zwei-Faktor-Anmeldung, keine Bankzugangsdaten, kein Tracking, keine Werbung.",
  },
];

export default async function StartPage() {
  const [user, canRegister] = await Promise.all([getCurrentUser(), registrationOpen()]);
  const a = example();
  const lines: Array<{ label: string; hint?: string; value: number; sign?: "−" | "+" | "="; strong?: boolean }> = [
    { label: "Kontostand", hint: "laut Bank", value: a.liquidBalance },
    { label: "Vorgemerkt", hint: "schon unterwegs", value: a.bankPending.total, sign: "−" },
    { label: "Fällig, noch nicht bezahlt", value: a.dueUnpaid.total, sign: "−" },
    { label: `Geplant bis ${formatDayShort(a.monthEnd)}`, value: a.plannedExpenses.total, sign: "−" },
    { label: "Aktuell verfügbar", value: a.available, sign: "=", strong: true },
    { label: "Erwartete Einnahmen", value: a.expectedIncome.total, sign: "+" },
    { label: `Voraussichtlich am ${formatDayShort(a.monthEnd)}`, value: a.projectedMonthEnd, sign: "=", strong: true },
  ];

  return (
    <>
      <section className="mx-auto grid max-w-[1120px] gap-10 px-4 pb-14 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        <div className="flex flex-col justify-center">
          <p className="label self-start rounded-[4px] bg-surface-secondary px-2 py-1">Private Finanzverwaltung</p>
          <h1 className="mt-4 text-[36px] font-semibold leading-[1.08] tracking-[-0.02em] sm:text-[48px]">Wie viel Geld ist wirklich verfügbar?</h1>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-muted">
            Nicht der Kontostand, sondern was davon übrig ist, wenn alles abgezogen ist, was schon feststeht: vorgemerkte Umsätze, fällige Abos,
            geplante Käufe. Dazu, was am Monatsende voraussichtlich bleibt.
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            {user ? (
              <LinkButton href="/">Zur Übersicht</LinkButton>
            ) : (
              <>
                <LinkButton href="/anmelden">Anmelden</LinkButton>
                {canRegister && (
                  <LinkButton href="/registrieren" variant="secondary">
                    Zugang einrichten
                  </LinkButton>
                )}
              </>
            )}
          </div>
          <p className="mt-4 text-[13px] text-muted">Zugang nur für freigegebene E-Mail-Adressen. Keine Bankzugangsdaten nötig.</p>
        </div>

        <figure className="panel self-center p-5">
          <div className="label">Aktuell verfügbar</div>
          <div className="kpi mt-1">
            <Figures text={formatMoney(a.available)} />
          </div>
          <div className="rows mt-3 border-t border-separator">
            {lines.map((line) => (
              <div key={line.label} className={`flex items-baseline justify-between gap-4 py-2 text-[13.5px] ${line.strong ? "font-semibold" : ""}`}>
                <span className="flex items-baseline gap-2">
                  <span aria-hidden className="num w-3 text-center text-muted">
                    {line.sign ?? ""}
                  </span>
                  <span>
                    {line.label}
                    {line.hint && <span className="label ml-1.5 font-normal">{line.hint}</span>}
                  </span>
                </span>
                <Money cents={line.sign === "−" && line.value ? -line.value : line.value} signed={line.sign === "+" || line.sign === "−"} tone="plain" />
              </div>
            ))}
          </div>
          <figcaption className="label mt-3 font-normal">Beispielrechnung mit erfundenen Werten – genau so rechnet die Übersicht.</figcaption>
        </figure>
      </section>

      <section className="mx-auto max-w-[1120px] px-4 pb-14 sm:px-6" aria-labelledby="funktionen">
        <h2 id="funktionen" className="text-[22px] font-semibold">Was drin ist</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: IconComponent, title, text }) => (
            <li key={title} className="panel p-5">
              <IconComponent className="size-5 text-accent" aria-hidden />
              <h3 className="mt-3 text-[15px] font-semibold">{title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-[1120px] px-4 pb-16 sm:px-6">
        <div className="panel flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-[18px] font-semibold">Auch als App – auf Handy und Computer</h2>
              <p className="mt-1 text-[13.5px] text-muted">Öffnet sich ohne Browserleiste wie eine eigene App, mit Symbol auf dem Startbildschirm. Kein App Store nötig.</p>
            </div>
            <SiteInstall />
          </div>
          {!user && <LinkButton href="/anmelden">Anmelden</LinkButton>}
        </div>
      </section>
    </>
  );
}
