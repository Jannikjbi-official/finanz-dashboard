import { addMonths, type ISODate } from "./calendar";
import type { ForecastEvent } from "./forecast";

export type ScenarioEventInput = {
  id: string;
  label: string;
  /** Vorzeichenbehaftet: negativ = Ausgabe. */
  amountCents: number;
  repeat: "once" | "monthly";
  date: ISODate;
  /** Letzter Termin bei monatlich, null = bis zum Ende der Prognose. */
  until: ISODate | null;
};

/** Szenario-Ereignisse in einzelne Prognose-Ereignisse aufloesen. */
export function expandScenario(events: ScenarioEventInput[], horizonEnd: ISODate): ForecastEvent[] {
  const result: ForecastEvent[] = [];

  for (const event of events) {
    if (!event.amountCents) continue;

    if (event.repeat === "once") {
      result.push({ date: event.date, amountCents: event.amountCents, label: event.label, source: "scenario", refId: event.id });
      continue;
    }

    const anchor = Number(event.date.slice(8, 10));
    const last = event.until && event.until < horizonEnd ? event.until : horizonEnd;
    for (let n = 0, date = event.date; date <= last && n < 600; n += 1, date = addMonths(event.date, n, anchor)) {
      result.push({ date, amountCents: event.amountCents, label: event.label, source: "scenario", refId: event.id });
    }
  }

  return result;
}
