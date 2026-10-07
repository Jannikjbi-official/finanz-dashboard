import { addDays, addMonths, daysInMonth, monthOf, monthStart, type ISODate } from "./calendar";
import { occurrencesBetween, type Interval } from "./schedule";

/**
 * Prognose-Engine.
 *
 * Rechnet ab heute Tag fuer Tag den verfuegbaren Kontostand voraus. Alle
 * Zukunftsfunktionen (Lage, Kalender, Sicherheitszone, Leistbarkeit,
 * Sandbox, Zielkonflikte) nutzen genau diese Rechnung - nur mit
 * unterschiedlichen Zusatz-Ereignissen.
 *
 * Grundsatz "vorsichtig": Ausgaben so frueh wie moeglich, erwartete
 * Einnahmen so spaet wie moeglich, Einnahmen ohne Termin gar nicht.
 */

export type Kind = "income" | "expense";

export type RecurringInput = {
  id: string;
  title: string;
  kind: Kind;
  amountCents: number;
  interval: Interval;
  startDate: ISODate;
  nextDue: ISODate;
  active: boolean;
};

export type PlannedInput = {
  id: string;
  title: string;
  kind: Kind;
  amountCents: number;
  dateFrom: ISODate | null;
  dateTo: ISODate | null;
  certainty: "fixed" | "expected";
};

export type GoalInput = {
  id: string;
  title: string;
  monthlyContributionCents: number | null;
  targetCents: number;
  savedCents: number;
};

export type EventSource = "recurring" | "planned" | "goal" | "scenario";

export type ForecastEvent = {
  date: ISODate;
  /** Vorzeichenbehaftet: negativ = Abfluss. */
  amountCents: number;
  label: string;
  source: EventSource;
  refId: string | null;
  /** Termin lag in der Vergangenheit und ist noch nicht gebucht. */
  overdue?: boolean;
};

export type ForecastInput = {
  today: ISODate;
  horizonDays: number;
  /** Verfuegbares Geld heute (liquide Konten, inkl. heutiger Buchungen). */
  openingBalanceCents: number;
  recurring: RecurringInput[];
  planned: PlannedInput[];
  goals: GoalInput[];
  /** Durchschnittliche variable Ausgaben pro Monat (ohne Fixkosten). */
  variableMonthlyCents: number;
  /** Davon im laufenden Monat schon ausgegeben. */
  variableSpentThisMonthCents: number;
  /** Hypothetische Ereignisse (Sandbox, Kaufpruefung). */
  extraEvents?: ForecastEvent[];
};

export type ForecastDay = {
  date: ISODate;
  /** Stand am Ende des Tages. */
  balanceCents: number;
  events: ForecastEvent[];
  /** Fuer variable Ausgaben eingeplanter Betrag an diesem Tag (negativ). */
  variableCents: number;
};

export type Forecast = {
  today: ISODate;
  openingBalanceCents: number;
  days: ForecastDay[];
  events: ForecastEvent[];
  /** Planbare Ereignisse ohne Termin - fliessen nicht ein, werden aber gezeigt. */
  undated: PlannedInput[];
};

export const HORIZONS = [7, 14, 30, 60, 90] as const;

export function buildForecast(input: ForecastInput): Forecast {
  const { today } = input;
  const end = addDays(today, input.horizonDays);
  const events: ForecastEvent[] = [];

  /* ---------------------------- Wiederkehrend ---------------------------- */
  // Steht die naechste Faelligkeit im laufenden Monat und ist noch offen, wird
  // sie heute faellig. Liegt sie weiter zurueck, wird das Abo offenbar nicht
  // ueber "Buchen" gepflegt - dann zaehlen nur Termine ab heute, sonst wuerde
  // doppelt gerechnet, was laengst manuell gebucht ist.
  const currentMonthStart = monthStart(monthOf(today));

  for (const entry of input.recurring) {
    if (!entry.active || entry.amountCents <= 0) continue;
    const from = entry.nextDue >= currentMonthStart ? entry.nextDue : today;
    const sign = entry.kind === "income" ? 1 : -1;

    for (const date of occurrencesBetween(entry.startDate, entry.interval, from, end)) {
      const overdue = date < today;
      events.push({
        date: overdue ? today : date,
        amountCents: sign * entry.amountCents,
        label: entry.title,
        source: "recurring",
        refId: entry.id,
        ...(overdue ? { overdue } : {}),
      });
    }
  }

  /* ------------------------------- Geplant ------------------------------- */
  const undated: PlannedInput[] = [];

  for (const item of input.planned) {
    if (item.amountCents <= 0) continue;

    // Ausgaben am fruehesten, Einnahmen am spaetesten moeglichen Tag
    const date =
      item.kind === "expense"
        ? (item.dateFrom ?? item.dateTo)
        : (item.dateTo ?? item.dateFrom);

    if (!date) {
      undated.push(item);
      continue;
    }
    if (date > end) continue;

    const overdue = date < today;
    events.push({
      date: overdue ? today : date,
      amountCents: (item.kind === "income" ? 1 : -1) * item.amountCents,
      label: item.title,
      source: "planned",
      refId: item.id,
      ...(overdue ? { overdue } : {}),
    });
  }

  /* ------------------------------ Sparraten ------------------------------ */
  // Ab dem naechsten Monatsersten; was diesen Monat schon gespart wurde, ist
  // im Kontostand bereits enthalten.
  for (const goal of input.goals) {
    const rate = goal.monthlyContributionCents ?? 0;
    if (rate <= 0) continue;

    let remaining = Math.max(0, goal.targetCents - goal.savedCents);
    let date = addMonths(currentMonthStart, 1);

    while (date <= end && remaining > 0) {
      const amount = Math.min(rate, remaining);
      events.push({
        date,
        amountCents: -amount,
        label: `Sparrate ${goal.title}`,
        source: "goal",
        refId: goal.id,
      });
      remaining -= amount;
      date = addMonths(date, 1);
    }
  }

  for (const extra of input.extraEvents ?? []) {
    if (extra.date > end) continue;
    events.push(extra.date < today ? { ...extra, date: today } : extra);
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || a.amountCents - b.amountCents);

  /* ------------------------------ Tagesreihe ----------------------------- */
  const byDate = new Map<ISODate, ForecastEvent[]>();
  for (const event of events) {
    byDate.set(event.date, [...(byDate.get(event.date) ?? []), event]);
  }

  const days: ForecastDay[] = [];
  let balance = input.openingBalanceCents;

  for (let offset = 0; offset <= input.horizonDays; offset += 1) {
    const date = addDays(today, offset);
    const dayEvents = byDate.get(date) ?? [];
    const variableCents = -variableForDay(input, date);

    balance += dayEvents.reduce((sum, event) => sum + event.amountCents, 0) + variableCents;
    days.push({ date, balanceCents: balance, events: dayEvents, variableCents });
  }

  return {
    today,
    openingBalanceCents: input.openingBalanceCents,
    days,
    events,
    undated,
  };
}

/**
 * Variable Ausgaben gleichmaessig verteilt: im laufenden Monat nur, was vom
 * Durchschnitt noch uebrig ist, danach der volle Durchschnitt.
 */
function variableForDay(input: ForecastInput, date: ISODate) {
  const monthly = Math.max(0, input.variableMonthlyCents);
  if (monthly === 0) return 0;

  const [year, month] = date.split("-").map(Number);
  const length = daysInMonth(year, month);

  if (monthOf(date) !== monthOf(input.today)) {
    return Math.round(monthly / length);
  }

  const remaining = Math.max(0, monthly - input.variableSpentThisMonthCents);
  const daysLeft = length - Number(input.today.slice(8, 10)) + 1;
  return Math.round(remaining / daysLeft);
}

/* -------------------------------- Auswertung ------------------------------- */

export function balanceAt(forecast: Forecast, offsetDays: number) {
  const index = Math.min(Math.max(0, offsetDays), forecast.days.length - 1);
  return forecast.days[index].balanceCents;
}

export function horizonBalances(forecast: Forecast) {
  return HORIZONS.filter((days) => days < forecast.days.length).map((days) => ({
    days,
    date: forecast.days[days].date,
    balanceCents: forecast.days[days].balanceCents,
  }));
}

/** Tiefster Stand innerhalb der ersten `withinDays` Tage (ab heute). */
export function lowestPoint(forecast: Forecast, withinDays = forecast.days.length - 1) {
  let lowest = forecast.days[0];
  for (const day of forecast.days.slice(0, withinDays + 1)) {
    if (day.balanceCents < lowest.balanceCents) lowest = day;
  }
  return { date: lowest.date, balanceCents: lowest.balanceCents };
}

/** Erster Tag, an dem der Stand unter `thresholdCents` faellt. */
export function firstDayBelow(forecast: Forecast, thresholdCents: number, withinDays?: number) {
  const days = withinDays === undefined ? forecast.days : forecast.days.slice(0, withinDays + 1);
  return days.find((day) => day.balanceCents < thresholdCents) ?? null;
}

/** Ein- und Ausgaenge eines Zeitraums, getrennt nach Herkunft. */
export function flowSummary(forecast: Forecast, withinDays: number) {
  const window = forecast.days.slice(1, withinDays + 1);
  const summary = { incomeCents: 0, fixedCents: 0, plannedCents: 0, goalCents: 0, variableCents: 0 };

  for (const day of [forecast.days[0], ...window]) {
    summary.variableCents += day.variableCents;
    for (const event of day.events) {
      if (event.amountCents > 0) summary.incomeCents += event.amountCents;
      else if (event.source === "recurring") summary.fixedCents += event.amountCents;
      else if (event.source === "goal") summary.goalCents += event.amountCents;
      else summary.plannedCents += event.amountCents;
    }
  }

  return summary;
}
