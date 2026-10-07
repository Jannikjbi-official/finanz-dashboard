import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Info,
  PiggyBank,
  Repeat,
  WarningCircle,
  CalendarCheck,
  CheckCircle,
} from "@phosphor-icons/react/dist/ssr";
import { requireUser } from "@/lib/session";
import { getBalanceHistory, getCategoryMonths, getMonthFlows, loadFinancialPicture } from "@/lib/server/finance";
import { buildInsights, type Insight } from "@/lib/server/insights";
import { horizonBalances, type ForecastEvent } from "@/lib/domain/forecast";
import { addDays, monthOf, shiftMonth } from "@/lib/domain/calendar";
import { changeRatio, savingsRate } from "@/lib/domain/insights";
import { formatDayShort, formatDayWithWeekday, formatMoney, formatPercent, formatRelativeDays } from "@/lib/format";
import { Money, Delta } from "@/ui/money";
import { Empty, IconTile, Pill } from "@/ui/layout";
import { SafetyScale } from "@/ui/safety";
import { TimelineChart } from "@/ui/timeline-chart";
import { Donut, CHART_COLORS } from "@/ui/donut";
import { ButtonLink } from "@/ui/button";
import { cx } from "@/ui/cx";

export const metadata = { title: "Lage" };

const SOURCE_LABEL: Record<ForecastEvent["source"], string> = {
  recurring: "Fixkosten",
  planned: "Geplant",
  goal: "Sparrate",
  scenario: "Szenario",
};

function greeting(name: string) {
  const hour = Number(new Intl.DateTimeFormat("de-DE", { hour: "numeric", timeZone: "Europe/Berlin" }).format(new Date()));
  const part = hour < 11 ? "Guten Morgen" : hour < 18 ? "Hallo" : "Guten Abend";
  const first = name.trim().split(/\s+/)[0];
  return first ? `${part}, ${first}` : part;
}

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

  const [history, flows, insights, categoryRows] = await Promise.all([
    getBalanceHistory(user.id, today, 60, picture.openingBalanceCents, liquidIds),
    getMonthFlows(user.id, shiftMonth(month, -1), month),
    buildInsights(user.id, picture),
    getCategoryMonths(user.id, month, month),
  ]);

  const isEmpty =
    picture.accounts.length === 0 && picture.recurring.length === 0 && history.every((p) => p.balanceCents === 0);

  if (isEmpty) {
    return (
      <div className="card max-w-2xl">
        <h1 className="text-[30px] font-bold leading-tight tracking-[-0.035em]">Noch ist hier nichts erfasst.</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          Lege ein Konto mit seinem aktuellen Stand an und trag dein Einkommen sowie die festen Kosten ein. Ab dann rechnet die Lage
          90 Tage voraus.
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

  const reserves = picture.accounts.filter((a) => !a.liquid && !a.archived).reduce((sum, a) => sum + a.balanceCents, 0);
  const liquidCount = picture.accounts.filter((a) => a.liquid && !a.archived).length;

  const upcoming = forecast.events.filter((event) => event.date <= addDays(today, 14)).slice(0, 8);

  const [prev, current] = flows;
  const net = current.incomeCents - current.expenseCents;
  const rate = savingsRate(current.incomeCents, current.expenseCents);
  const expenseChange = changeRatio(current.expenseCents, prev.expenseCents);

  const categoryById = new Map(picture.categories.map((c) => [c.id, c]));
  const slices = categoryRows
    .filter((row) => row.month === month)
    .sort((a, b) => b.sumCents - a.sumCents)
    .map((row, index) => {
      const category = row.categoryId ? categoryById.get(row.categoryId) : undefined;
      return { label: category?.name ?? "Ohne Kategorie", cents: row.sumCents, color: CHART_COLORS[index % CHART_COLORS.length] };
    });
  const topSlices = slices.length > 5 ? [...slices.slice(0, 4), { label: "Weitere", cents: slices.slice(4).reduce((s, x) => s + x.cents, 0), color: "var(--ink-3)" }] : slices;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <p className="px-1 text-[15px] font-semibold text-ink-2">{greeting(user.name)}</p>

      {/* ------------------------- Wie steht es? ------------------------- */}
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-[1.6fr_1fr]">
        <section className="card flex flex-col gap-5 animate-[rise_300ms_ease-out]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-ink-3">Verfügbar heute</p>
              <Money cents={picture.openingBalanceCents} className="mt-1 block text-[46px] font-extrabold leading-none tracking-[-0.045em] sm:text-[60px]" />
              <p className="mt-3 text-[13px] text-ink-3">
                {picture.usesAccounts
                  ? `${liquidCount} ${liquidCount === 1 ? "Konto" : "Konten"}${reserves > 0 ? ` · ${formatMoney(reserves, { whole: true })} in Rücklagen` : ""}`
                  : "Summe aller Buchungen – lege Konten an für echte Kontostände."}
              </p>
            </div>
            <SafetyScale level={safety.level} />
          </div>
          <div className="rounded-[16px] bg-surface-2 p-4">
            <p className="text-[14px] leading-relaxed text-ink-2">{safety.reasons[0]}</p>
            <Link href="/app/einstellungen#reserve" className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-3 hover:text-ink">
              So entsteht die Einstufung <ArrowRight size={13} />
            </Link>
          </div>
        </section>

        <section className="flex flex-col justify-between gap-6 rounded-[22px] bg-accent p-5 text-accent-ink sm:p-6 animate-[rise_380ms_ease-out]">
          <div>
            <p className="text-[13px] font-bold opacity-70">Dein Spielraum</p>
            <Money cents={safety.headroomCents} whole className="mt-1 block text-[44px] font-extrabold leading-none tracking-[-0.045em]" />
            <p className="mt-3 text-[14px] font-medium leading-relaxed opacity-80">
              {safety.headroomCents > 0
                ? `Kannst du heute ausgeben, ohne in 90 Tagen unter ${safety.reserveCents > 0 ? `deine Reserve von ${formatMoney(safety.reserveCents, { whole: true })}` : "null"} zu fallen.`
                : "Gerade kein Puffer über der Reserve – jede Extra-Ausgabe geht an die Reserve."}
            </p>
          </div>
          <Link href="/app/entscheiden" className="inline-flex h-11 items-center justify-between gap-2 rounded-full bg-accent-ink px-5 text-[14px] font-bold text-accent">
            Kann ich mir das leisten?
            <ArrowRight size={16} weight="bold" />
          </Link>
        </section>
      </div>

      {/* ---------------------------- Zeitachse --------------------------- */}
      <section className="card">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[17px] font-bold tracking-[-0.02em]">Verlauf und Prognose</h2>
          <p className="text-[12px] font-medium text-ink-3">
            60 Tage zurück · 90 voraus ·{" "}
            {picture.monthly.variableSource === "history"
              ? `Ø Alltag ${formatMoney(picture.monthly.variableCents, { whole: true })}/Monat`
              : picture.monthly.variableSource === "estimate"
                ? `Alltag geschätzt ${formatMoney(picture.monthly.variableCents, { whole: true })}/Monat`
                : "noch ohne Alltagsausgaben"}
          </p>
        </div>
        <TimelineChart
          height={260}
          series={{ past: history, future: forecast.days.map((d) => ({ date: d.date, balanceCents: d.balanceCents })) }}
          events={forecast.events.map((e) => ({ date: e.date, amountCents: e.amountCents, label: e.label }))}
          reserveCents={safety.reserveCents}
          ariaLabel={`Kontostand: heute ${formatMoney(picture.openingBalanceCents)}, tiefster Stand der nächsten 90 Tage ${formatMoney(safety.low90.balanceCents)} am ${formatDayShort(safety.low90.date)}`}
        />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {horizonBalances(forecast).map((h) => {
            const below = h.balanceCents < safety.reserveCents;
            return (
              <div key={h.days} className={cx("rounded-[14px] px-3.5 py-3", below ? "bg-caution-soft" : "bg-surface-2")}>
                <p className="text-[11.5px] font-semibold text-ink-3">in {h.days} Tagen</p>
                <Money cents={h.balanceCents} whole className={cx("mt-0.5 block text-[18px] font-bold tracking-[-0.03em]", below && "text-caution")} />
              </div>
            );
          })}
        </div>
      </section>

      {/* ----------------------- Was kommt / beachten --------------------- */}
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[17px] font-bold tracking-[-0.02em]">Als Nächstes</h2>
            <Link href="/app/planung" className="text-[13px] font-semibold text-ink-3 hover:text-ink">
              Kalender
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <Empty title="Zwei ruhige Wochen.">In den nächsten 14 Tagen steht nichts Festes an.</Empty>
          ) : (
            <ul className="flex flex-col gap-1">
              {upcoming.map((event, index) => {
                const offset = forecast.days.findIndex((d) => d.date === event.date);
                const income = event.amountCents > 0;
                const Icon = income ? ArrowDownLeft : event.source === "goal" ? PiggyBank : event.source === "recurring" ? Repeat : ArrowUpRight;
                return (
                  <li key={index} className="flex items-center gap-3 rounded-[14px] px-1 py-2">
                    <IconTile color={income ? "var(--pos)" : event.source === "goal" ? "var(--chart-2)" : "var(--chart-3)"}>
                      <Icon size={18} weight="bold" />
                    </IconTile>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold">{event.label}</p>
                      <p className="text-[12px] text-ink-3">
                        {event.overdue ? "überfällig" : `${formatDayWithWeekday(event.date)} · ${formatRelativeDays(offset)}`} · {SOURCE_LABEL[event.source]}
                      </p>
                    </div>
                    <Money cents={event.amountCents} tone="flow" className="text-[15px] font-bold" />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="mb-3 text-[17px] font-bold tracking-[-0.02em]">Beachten</h2>
          <InsightList insights={insights} />
        </section>
      </div>

      {/* ---------------------------- Dieser Monat ------------------------ */}
      <section className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-bold tracking-[-0.02em]">Dieser Monat bisher</h2>
          <Link href="/app/rueckblick" className="text-[13px] font-semibold text-ink-3 hover:text-ink">
            Monatsbericht
          </Link>
        </div>
        <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Einnahmen" icon={<ArrowDownLeft size={16} weight="bold" />} color="var(--pos)">
              <Money cents={current.incomeCents} whole />
            </Stat>
            <Stat label="Ausgaben" icon={<ArrowUpRight size={16} weight="bold" />} color="var(--chart-4)">
              <Money cents={current.expenseCents} whole />
            </Stat>
            <Stat label="Übrig" icon={<CheckCircle size={16} weight="bold" />} color="var(--accent)">
              <Money cents={net} whole tone="flow" />
            </Stat>
            <Stat label="Sparquote" icon={<PiggyBank size={16} weight="bold" />} color="var(--chart-2)">
              <span className="num">{rate !== null ? formatPercent(rate) : "–"}</span>
            </Stat>
          </div>

          <div className="flex justify-center">
            <Donut slices={topSlices} centerLabel="Ausgaben" centerValue={current.expenseCents} size={190} thickness={20} />
          </div>

          <ul className="flex flex-col gap-2">
            {topSlices.length === 0 ? <li className="text-[14px] text-ink-3">Noch keine Ausgaben in diesem Monat.</li> : null}
            {topSlices.map((slice) => (
              <li key={slice.label} className="flex items-center justify-between gap-3 text-[14px]">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="size-3 shrink-0 rounded-full" style={{ background: slice.color }} />
                  <span className="truncate font-medium">{slice.label}</span>
                </span>
                <span className="flex items-baseline gap-2">
                  <span className="num text-[12px] text-ink-3">{current.expenseCents ? formatPercent(slice.cents / current.expenseCents) : ""}</span>
                  <Money cents={slice.cents} whole className="font-bold" />
                </span>
              </li>
            ))}
            {expenseChange !== null && prev.expenseCents > 0 ? (
              <li className="mt-2 text-[12px] text-ink-3">
                Ausgaben bisher <Delta value={expenseChange} invert text={formatPercent(expenseChange, { signed: true })} /> ggü. dem ganzen
                Vormonat
              </li>
            ) : null}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, icon, color, children }: { label: string; icon: React.ReactNode; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[16px] bg-surface-2 p-3.5">
      <span className="flex items-center gap-2 text-[12px] font-semibold text-ink-3">
        <span className="inline-flex size-6 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}>
          {icon}
        </span>
        {label}
      </span>
      <p className="mt-2 text-[20px] font-bold tracking-[-0.03em]">{children}</p>
    </div>
  );
}

const TONE: Record<Insight["tone"], { color: string; Icon: typeof Info }> = {
  neg: { color: "var(--neg)", Icon: WarningCircle },
  caution: { color: "var(--caution)", Icon: WarningCircle },
  warn: { color: "var(--warn)", Icon: WarningCircle },
  info: { color: "var(--chart-3)", Icon: Info },
  pos: { color: "var(--pos)", Icon: CalendarCheck },
};

function InsightList({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return <Empty title="Nichts Besonderes.">Sobald Buchungen und Budgets vorliegen, erscheinen hier Hinweise.</Empty>;
  }
  return (
    <ul className="flex flex-col gap-1">
      {insights.map((insight) => {
        const { color, Icon } = TONE[insight.tone];
        const body = (
          <div className="flex gap-3 rounded-[14px] px-1 py-2.5">
            <IconTile color={color}>
              <Icon size={18} weight="bold" />
            </IconTile>
            <div className="min-w-0">
              <p className="text-[14px] font-bold leading-snug">{insight.title}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{insight.detail}</p>
              {insight.action ? <Pill tone="accent" className="mt-2">{insight.action}</Pill> : null}
            </div>
          </div>
        );
        return (
          <li key={insight.id}>
            {insight.href ? (
              <Link href={insight.href} className="block rounded-[14px] transition-colors hover:bg-surface-2">
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

