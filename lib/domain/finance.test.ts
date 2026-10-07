import { describe, expect, it } from "vitest";
import {
  buildForecast,
  firstDayBelow,
  flowSummary,
  horizonBalances,
  lowestPoint,
  type ForecastInput,
} from "./forecast";
import { evaluateSafety, resolveReserve } from "./safety";
import { checkAffordability, purchaseEvents } from "./affordability";
import { goalState } from "./goals";
import { projectBudget } from "./budgets";
import { findAnomalies, savingsRate } from "./insights";
import { expandScenario } from "./scenario";

const eur = (cents: number) => `${(cents / 100).toFixed(2)} €`;
const day = (date: string) => date;

/** Typischer Fall: Gehalt am 1., Miete am 3., Netflix am 15. */
function baseInput(overrides: Partial<ForecastInput> = {}): ForecastInput {
  return {
    today: "2026-10-07",
    horizonDays: 90,
    openingBalanceCents: 1500_00,
    recurring: [
      { id: "gehalt", title: "Gehalt", kind: "income", amountCents: 2500_00, interval: "monthly", startDate: "2026-01-01", nextDue: "2026-11-01", active: true },
      { id: "miete", title: "Miete", kind: "expense", amountCents: 900_00, interval: "monthly", startDate: "2026-01-03", nextDue: "2026-11-03", active: true },
      { id: "netflix", title: "Netflix", kind: "expense", amountCents: 13_99, interval: "monthly", startDate: "2026-01-15", nextDue: "2026-10-15", active: true },
      { id: "pausiert", title: "Gym", kind: "expense", amountCents: 30_00, interval: "monthly", startDate: "2026-01-10", nextDue: "2026-10-10", active: false },
    ],
    planned: [],
    goals: [],
    variableMonthlyCents: 0,
    variableSpentThisMonthCents: 0,
    ...overrides,
  };
}

describe("Prognose", () => {
  it("bucht wiederkehrende Zahlungen an den richtigen Tagen", () => {
    const forecast = buildForecast(baseInput());
    const labels = forecast.events.slice(0, 4).map((e) => `${e.date} ${e.label}`);
    expect(labels).toEqual([
      "2026-10-15 Netflix",
      "2026-11-01 Gehalt",
      "2026-11-03 Miete",
      "2026-11-15 Netflix",
    ]);
    // Pausierte Abos zaehlen nicht
    expect(forecast.events.some((e) => e.refId === "pausiert")).toBe(false);
    expect(forecast.days[8].balanceCents).toBe(1500_00 - 13_99);
  });

  it("liefert Staende fuer die Prognose-Horizonte", () => {
    const forecast = buildForecast(baseInput());
    const horizons = horizonBalances(forecast);
    expect(horizons.map((h) => h.days)).toEqual([7, 14, 30, 60, 90]);
    // +30 Tage = 06.11.: Gehalt und Miete sind durch
    expect(horizons[2]).toEqual({ days: 30, date: "2026-11-06", balanceCents: 1500_00 - 13_99 + 2500_00 - 900_00 });
  });

  it("verteilt variable Ausgaben, im laufenden Monat nur den Rest", () => {
    const forecast = buildForecast(
      baseInput({ recurring: [], variableMonthlyCents: 500_00, variableSpentThisMonthCents: 250_00 }),
    );
    // Oktober: 250 € Rest auf 25 Tage (7.-31.) = 10 €/Tag
    expect(forecast.days[0].variableCents).toBe(-10_00);
    const october = forecast.days.filter((d) => d.date.startsWith("2026-10"));
    expect(october.reduce((s, d) => s + d.variableCents, 0)).toBe(-250_00);
    // November: 500 € auf 30 Tage
    expect(forecast.days.find((d) => d.date === "2026-11-10")?.variableCents).toBe(-16_67);
  });

  it("plant vorsichtig: Ausgaben frueh, Einnahmen spaet, ohne Termin gar nicht", () => {
    const forecast = buildForecast(
      baseInput({
        recurring: [],
        planned: [
          { id: "p1", title: "Reparatur", kind: "expense", amountCents: 300_00, dateFrom: "2026-10-20", dateTo: "2026-10-31", certainty: "fixed" },
          { id: "p2", title: "Erstattung", kind: "income", amountCents: 80_00, dateFrom: "2026-10-10", dateTo: "2026-11-30", certainty: "expected" },
          { id: "p3", title: "Steuer", kind: "income", amountCents: 400_00, dateFrom: null, dateTo: null, certainty: "expected" },
          { id: "p4", title: "Ueberfaellig", kind: "expense", amountCents: 50_00, dateFrom: "2026-10-01", dateTo: null, certainty: "fixed" },
        ],
      }),
    );
    expect(forecast.events.map((e) => `${e.date} ${e.label}`)).toEqual([
      "2026-10-07 Ueberfaellig",
      "2026-10-20 Reparatur",
      "2026-11-30 Erstattung",
    ]);
    expect(forecast.events[0].overdue).toBe(true);
    expect(forecast.undated.map((p) => p.id)).toEqual(["p3"]);
  });

  it("zaehlt offene Abos aus dem laufenden Monat, nie gepflegte erst ab heute", () => {
    const forecast = buildForecast(
      baseInput({
        recurring: [
          { id: "a", title: "Strom", kind: "expense", amountCents: 80_00, interval: "monthly", startDate: "2026-01-05", nextDue: "2026-10-05", active: true },
          { id: "b", title: "Alt", kind: "expense", amountCents: 10_00, interval: "monthly", startDate: "2025-01-02", nextDue: "2025-03-02", active: true },
        ],
      }),
    );
    const today = forecast.events.filter((e) => e.date === "2026-10-07");
    expect(today.map((e) => e.label)).toEqual(["Strom"]);
    expect(forecast.events.find((e) => e.label === "Alt")?.date).toBe("2026-11-02");
  });

  it("plant Sparraten ab naechstem Monat bis zum Ziel", () => {
    const forecast = buildForecast(
      baseInput({
        recurring: [],
        goals: [{ id: "g", title: "Urlaub", monthlyContributionCents: 200_00, targetCents: 1000_00, savedCents: 700_00 }],
      }),
    );
    const goal = forecast.events.filter((e) => e.source === "goal");
    expect(goal.map((e) => [e.date, e.amountCents])).toEqual([
      ["2026-11-01", -200_00],
      ["2026-12-01", -100_00],
    ]);
  });

  it("findet Tiefpunkt und Unterschreitung", () => {
    const forecast = buildForecast(baseInput({ openingBalanceCents: 100_00, recurring: [baseInput().recurring[2]] }));
    expect(lowestPoint(forecast, 30)).toEqual({ date: "2026-10-15", balanceCents: 100_00 - 13_99 });
    expect(lowestPoint(forecast, 60)).toEqual({ date: "2026-11-15", balanceCents: 100_00 - 2 * 13_99 });
    expect(firstDayBelow(forecast, 90_00)?.date).toBe("2026-10-15");
    expect(flowSummary(forecast, 30).fixedCents).toBe(-13_99);
  });
});

describe("Sicherheitszone", () => {
  it("nimmt ohne eigene Reserve einen Monat Fixkosten", () => {
    expect(resolveReserve(null, 913_99)).toEqual({ reserveCents: 913_99, reserveSource: "fixed-costs" });
    expect(resolveReserve(500_00, 913_99)).toEqual({ reserveCents: 500_00, reserveSource: "custom" });
    expect(resolveReserve(null, 0)).toEqual({ reserveCents: 0, reserveSource: "none" });
  });

  it("stuft nachvollziehbar ein", () => {
    const stable = evaluateSafety(buildForecast(baseInput()), resolveReserve(500_00, 0), eur, day);
    expect(stable.level).toBe("stable");
    expect(stable.reasons[0]).toContain("bleibt dein Stand über");

    const below = evaluateSafety(buildForecast(baseInput({ openingBalanceCents: 300_00 })), resolveReserve(500_00, 0), eur, day);
    expect(below.level).toBe("below");

    // Miete am 03.11. vor dem Gehalt? Nein - Gehalt kommt am 01. Also: Reserve knapp unter Stand
    const critical = evaluateSafety(
      buildForecast(baseInput({ openingBalanceCents: 510_00 })),
      resolveReserve(500_00, 0),
      eur,
      day,
    );
    expect(critical.level).toBe("critical");
    expect(critical.breach?.date).toBe("2026-10-15");

    const tight = evaluateSafety(
      buildForecast(baseInput({ openingBalanceCents: 560_00 })),
      resolveReserve(500_00, 0),
      eur,
      day,
    );
    expect(tight.level).toBe("tight");
  });

  it("berechnet den Spielraum ueber der Reserve", () => {
    const report = evaluateSafety(buildForecast(baseInput()), resolveReserve(500_00, 0), eur, day);
    // Tiefster Stand in 90 Tagen: 1500 - 13,99 = 1486,01 am 15.10.
    expect(report.low90.balanceCents).toBe(1486_01);
    expect(report.headroomCents).toBe(986_01);
  });
});

describe("Kann ich mir das leisten?", () => {
  const input = baseInput();
  const goals = [{ id: "g", title: "Urlaub", monthlyContributionCents: 200_00, targetCents: 2000_00, savedCents: 0 }];

  it("bewertet einen gedeckten Kauf", () => {
    const result = checkAffordability(input, { label: "Laptop", amountCents: 300_00, date: "2026-10-07" }, 500_00, goals);
    expect(result.verdict).toBe("comfortable");
    expect(result.after.onDateCents).toBe(1200_00);
    expect(result.gapCents).toBe(0);
    expect(result.goalImpacts[0].delayMonths).toBe(0);
    expect(result.recovery?.months).toBe(1);
  });

  it("zeigt Reserve-Unterschreitung und Zielkonflikt", () => {
    const result = checkAffordability(input, { label: "Laptop", amountCents: 1200_00, date: "2026-10-07" }, 500_00, goals);
    expect(result.verdict).toBe("tight");
    expect(result.reserveBreach?.date).toBe("2026-10-07");
    expect(result.overdraft).toBeNull();
    // Spielraum 986,01 € -> es fehlen 213,99 €, bei 200 €/Monat Sparrate 2 Monate
    expect(result.gapCents).toBe(213_99);
    expect(result.goalImpacts[0].delayMonths).toBe(2);
  });

  it("erkennt nicht gedeckte Kaeufe", () => {
    // 1.499 € von 1.500 € - danach reicht es nicht einmal fuer Netflix am 15.
    const result = checkAffordability(input, { label: "Laptop", amountCents: 1499_00, date: "2026-10-07" }, 500_00, []);
    expect(result.verdict).toBe("not-affordable");
    expect(result.overdraft?.date).toBe("2026-10-15");
  });

  it("verteilt Raten mit Rundungsrest auf die erste", () => {
    const events = purchaseEvents({ label: "Sofa", amountCents: 1000_00, date: "2026-10-31", installments: 3 });
    expect(events.map((e) => [e.date, e.amountCents])).toEqual([
      ["2026-10-31", -333_34],
      ["2026-11-30", -333_33],
      ["2026-12-31", -333_33],
    ]);
  });
});

describe("Sparziele", () => {
  it("berechnet Rate, Termin und Status", () => {
    const state = goalState(
      { targetCents: 1200_00, savedCents: 200_00, deadline: "2027-04-30", monthlyContributionCents: 100_00 },
      "2026-10-07",
    );
    expect(state.monthsLeft).toBe(6);
    expect(state.requiredMonthlyCents).toBe(166_67);
    expect(state.expectedMonth).toBe("2027-08");
    expect(state.status).toBe("behind");

    expect(goalState({ targetCents: 100_00, savedCents: 100_00, deadline: null, monthlyContributionCents: null }, "2026-10-07").status).toBe("reached");
    expect(goalState({ targetCents: 100_00, savedCents: 0, deadline: null, monthlyContributionCents: null }, "2026-10-07").status).toBe("no-plan");
  });
});

describe("Budgets", () => {
  it("rechnet bis Monatsende hoch", () => {
    // 10 von 31 Tagen, 150 € ausgegeben, Durchschnitt 300 €
    const projection = projectBudget({ budgetCents: 300_00, spentCents: 150_00, averageCents: 300_00 }, "2026-10", "2026-10-10");
    expect(projection.projectedCents).toBeGreaterThan(300_00);
    expect(projection.status).toBe("projected-over");
    expect(projection.remainingCents).toBe(150_00);

    const closed = projectBudget({ budgetCents: 300_00, spentCents: 240_00, averageCents: 0 }, "2026-09", "2026-10-10");
    expect(closed).toMatchObject({ projectedCents: 240_00, method: "closed", status: "watch" });
  });
});

describe("Auffaelligkeiten", () => {
  it("vergleicht mit dem eigenen Durchschnitt, anteilig im laufenden Monat", () => {
    const anomalies = findAnomalies(
      [
        { categoryId: "f", name: "Freizeit", currentCents: 131_00, previousCents: [100_00, 100_00, 100_00] },
        { categoryId: "l", name: "Lebensmittel", currentCents: 105_00, previousCents: [300_00, 300_00] },
        { categoryId: "n", name: "Neu", currentCents: 80_00, previousCents: [0, 0] },
      ],
      "2026-09",
      "2026-10-07",
    );
    expect(anomalies.map((a) => [a.name, a.direction])).toEqual([
      ["Lebensmittel", "lower"],
      ["Neu", "new"],
      ["Freizeit", "higher"],
    ]);
    expect(anomalies.find((a) => a.name === "Freizeit")?.changeRatio).toBeCloseTo(0.31);
  });

  it("sparquote", () => {
    expect(savingsRate(2000_00, 1500_00)).toBe(0.25);
    expect(savingsRate(0, 100)).toBeNull();
  });
});

describe("Sandbox", () => {
  it("loest monatliche Ereignisse bis zum Ende auf", () => {
    const events = expandScenario(
      [
        { id: "a", label: "Fitnessstudio", amountCents: -40_00, repeat: "monthly", date: "2026-10-31", until: "2027-01-31" },
        { id: "b", label: "Bonus", amountCents: 500_00, repeat: "once", date: "2026-12-15", until: null },
      ],
      "2027-06-30",
    );
    expect(events.map((e) => `${e.date} ${e.amountCents}`)).toEqual([
      "2026-10-31 -4000",
      "2026-11-30 -4000",
      "2026-12-31 -4000",
      "2027-01-31 -4000",
      "2026-12-15 50000",
    ]);
  });

  it("veraendert nur die Prognose, nicht die Eingabe", () => {
    const input = baseInput();
    const before = JSON.stringify(input);
    const extra = expandScenario([{ id: "x", label: "Kauf", amountCents: -100_00, repeat: "once", date: "2026-10-08", until: null }], "2027-01-05");
    const forecast = buildForecast({ ...input, extraEvents: extra });
    expect(forecast.days[1].balanceCents).toBe(1500_00 - 100_00);
    expect(JSON.stringify(input)).toBe(before);
  });
});
