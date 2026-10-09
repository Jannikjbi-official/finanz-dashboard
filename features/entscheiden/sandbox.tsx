"use client";

import { useMemo, useState, useTransition } from "react";
import { Flask, Plus, Trash } from "@phosphor-icons/react/dist/ssr";
import { addDays, addMonths } from "@/lib/domain/calendar";
import { buildForecast, firstDayBelow, lowestPoint, type ForecastInput } from "@/lib/domain/forecast";
import { evaluateSafety, type ReserveSource } from "@/lib/domain/safety";
import { expandScenario, type ScenarioEventInput } from "@/lib/domain/scenario";
import { deleteScenario, saveScenario } from "@/lib/server/actions/planning";
import { formatDayShort, formatMoney } from "@/lib/format";
import { parseSignedAmount } from "@/lib/import";
import { Button } from "@/ui/button";
import { Input, Segmented, Select } from "@/ui/field";
import { Money } from "@/ui/money";
import { Note, Section } from "@/ui/layout";
import { SafetyScale } from "@/ui/safety";
import { TimelineChart } from "@/ui/timeline-chart";
import { useToast } from "@/ui/toast";
import { cx } from "@/ui/cx";

export type SavedScenario = { id: string; name: string; events: ScenarioEventInput[] };

type Draft = {
  id: string;
  label: string;
  amount: string;
  direction: "out" | "in";
  repeat: "once" | "monthly";
  date: string;
  until: string;
};

let counter = 0;
const newId = () => `e${Date.now().toString(36)}${(counter++).toString(36)}`;

function toDraft(event: ScenarioEventInput): Draft {
  return {
    id: event.id,
    label: event.label,
    amount: (Math.abs(event.amountCents) / 100).toFixed(2).replace(".", ","),
    direction: event.amountCents < 0 ? "out" : "in",
    repeat: event.repeat,
    date: event.date,
    until: event.until ?? "",
  };
}

function toEvent(draft: Draft): ScenarioEventInput | null {
  const cents = parseSignedAmount(draft.amount);
  if (!cents || !draft.date) return null;
  return {
    id: draft.id,
    label: draft.label.trim() || (draft.direction === "out" ? "Ausgabe" : "Einnahme"),
    amountCents: Math.abs(cents) * (draft.direction === "out" ? -1 : 1),
    repeat: draft.repeat,
    date: draft.date,
    until: draft.repeat === "monthly" && draft.until ? draft.until : null,
  };
}

const PRESETS: Array<{ label: string; make: (today: string) => Omit<Draft, "id"> }> = [
  { label: "Großer Kauf", make: (t) => ({ label: "Großer Kauf", amount: "1.000", direction: "out", repeat: "once", date: t, until: "" }) },
  { label: "Mehr Einkommen", make: (t) => ({ label: "Gehaltserhöhung", amount: "100", direction: "in", repeat: "monthly", date: addMonths(`${t.slice(0, 7)}-01`, 1), until: "" }) },
  { label: "Neuer Vertrag", make: (t) => ({ label: "Neuer Vertrag", amount: "30", direction: "out", repeat: "monthly", date: t, until: "" }) },
  { label: "Kosten fallen weg", make: (t) => ({ label: "Kündigung", amount: "50", direction: "in", repeat: "monthly", date: addMonths(`${t.slice(0, 7)}-01`, 1), until: "" }) },
  { label: "Zusätzliche Rechnung", make: (t) => ({ label: "Rechnung", amount: "250", direction: "out", repeat: "once", date: addDays(t, 14), until: "" }) },
];

export function Sandbox({
  input,
  reserve,
  scenarios,
  initial,
}: {
  input: Omit<ForecastInput, "horizonDays" | "extraEvents">;
  reserve: { reserveCents: number; reserveSource: ReserveSource };
  scenarios: SavedScenario[];
  initial: ScenarioEventInput[];
}) {
  const [drafts, setDrafts] = useState<Draft[]>(initial.map(toDraft));
  const [horizon, setHorizon] = useState<"90" | "180" | "365">("180");
  const [current, setCurrent] = useState<SavedScenario | null>(null);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const days = Number(horizon);
  const events = drafts.map(toEvent).filter((e): e is ScenarioEventInput => e !== null);

  const { base, withScenario, before, after } = useMemo(() => {
    const end = addDays(input.today, days);
    const baseForecast = buildForecast({ ...input, horizonDays: days });
    const scenarioForecast = buildForecast({ ...input, horizonDays: days, extraEvents: expandScenario(events, end) });
    const fmt = (c: number) => formatMoney(c);
    return {
      base: baseForecast,
      withScenario: scenarioForecast,
      before: evaluateSafety(baseForecast, reserve, fmt, formatDayShort),
      after: evaluateSafety(scenarioForecast, reserve, fmt, formatDayShort),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, reserve, days, JSON.stringify(events)]);

  const end = (f: typeof base) => f.days[f.days.length - 1].balanceCents;
  const lowBase = lowestPoint(base);
  const lowAfter = lowestPoint(withScenario);
  const breach = firstDayBelow(withScenario, reserve.reserveCents);

  function update(id: string, patch: Partial<Draft>) {
    setDrafts((list) => list.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function save() {
    startTransition(async () => {
      const result = await saveScenario({ id: current?.id ?? null, name: name.trim() || "Szenario", events });
      if (result.ok) {
        toast(result.message ?? "Gespeichert");
        setCurrent({ id: result.id!, name: name.trim() || "Szenario", events });
      } else toast(result.error ?? "Speichern fehlgeschlagen", "error");
    });
  }

  function load(id: string) {
    const scenario = scenarios.find((s) => s.id === id);
    if (!scenario) return;
    setCurrent(scenario);
    setName(scenario.name);
    setDrafts(scenario.events.map(toDraft));
  }

  function remove() {
    if (!current) return;
    startTransition(async () => {
      const result = await deleteScenario(current.id);
      toast(result.ok ? (result.message ?? "Gelöscht") : (result.error ?? "Fehler"), result.ok ? "ok" : "error");
      if (result.ok) {
        setCurrent(null);
        setName("");
        setDrafts([]);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[13px] text-ink-3">
            <Flask size={14} /> Nichts hier verändert deine echten Daten
          </p>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em] sm:text-[28px]">Sandbox</h1>
          <p className="mt-1.5 max-w-2xl text-[14px] text-ink-2">Was wäre, wenn …? Spiel Ereignisse durch und sieh sofort, was sie mit deiner Prognose machen.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {scenarios.length > 0 ? (
            <Select aria-label="Gespeichertes Szenario laden" value={current?.id ?? ""} onChange={(e) => load(e.target.value)} className="w-52">
              <option value="">Szenario laden …</option>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          ) : null}
          <Segmented
            name="horizon"
            size="sm"
            value={horizon}
            onChange={setHorizon}
            options={[
              { value: "90", label: "90 T." },
              { value: "180", label: "6 Mon." },
              { value: "365", label: "1 Jahr" },
            ]}
          />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[26rem_1fr]">
        {/* Ereignisse */}
        <section className="flex flex-col gap-4">
          <h2 className="border-b border-line pb-2 text-[15px] font-semibold">Ereignisse</h2>
          {drafts.length === 0 ? <p className="text-[14px] text-ink-3">Noch nichts angenommen. Starte mit einer Vorlage:</p> : null}

          <ul className="flex flex-col gap-3">
            {drafts.map((draft) => {
              const valid = toEvent(draft) !== null;
              return (
                <li key={draft.id} className={cx("flex flex-col gap-2 border-b border-line pb-3", !valid && "opacity-70")}>
                  <div className="flex gap-2">
                    <Input aria-label="Bezeichnung" value={draft.label} onChange={(e) => update(draft.id, { label: e.target.value })} className="h-9" maxLength={60} />
                    <button
                      type="button"
                      aria-label="Ereignis entfernen"
                      onClick={() => setDrafts((list) => list.filter((d) => d.id !== draft.id))}
                      className="rounded-sm px-2 text-ink-3 hover:bg-sunken hover:text-neg"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-[auto_1fr] gap-2">
                    <Segmented
                      name={`dir-${draft.id}`}
                      size="sm"
                      value={draft.direction}
                      onChange={(v) => update(draft.id, { direction: v })}
                      options={[
                        { value: "out", label: "−" },
                        { value: "in", label: "+" },
                      ]}
                    />
                    <div className="relative">
                      <Input aria-label="Betrag" inputMode="decimal" value={draft.amount} onChange={(e) => update(draft.id, { amount: e.target.value })} className="num h-9 pr-7 text-right" />
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-ink-3">€</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-2">
                    <Segmented
                      name={`rep-${draft.id}`}
                      size="sm"
                      value={draft.repeat}
                      onChange={(v) => update(draft.id, { repeat: v })}
                      options={[
                        { value: "once", label: "einmal" },
                        { value: "monthly", label: "monatlich" },
                      ]}
                    />
                    <Input type="date" aria-label={draft.repeat === "monthly" ? "Ab" : "Am"} value={draft.date} min={input.today} onChange={(e) => update(draft.id, { date: e.target.value })} className="h-9 text-[13px]" />
                    {draft.repeat === "monthly" ? (
                      <Input type="date" aria-label="Bis (optional)" title="Bis (leer = unbegrenzt)" value={draft.until} min={draft.date} onChange={(e) => update(draft.id, { until: e.target.value })} className="h-9 text-[13px]" />
                    ) : (
                      <span />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setDrafts((list) => [...list, { id: newId(), ...preset.make(input.today) }])}
                className="inline-flex h-8 items-center gap-1 rounded-sm border border-line-strong px-2.5 text-[12px] text-ink-2 hover:border-ink-3 hover:text-ink"
              >
                <Plus size={12} weight="bold" /> {preset.label}
              </button>
            ))}
          </div>

          <div className="mt-2 flex flex-col gap-2 border-t border-line pt-4">
            <Input aria-label="Name des Szenarios" placeholder="Name, z. B. „Umzug nach Leipzig“" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            <div className="flex gap-2">
              <Button onClick={save} pending={pending} disabled={events.length === 0}>
                {current ? "Änderungen speichern" : "Szenario speichern"}
              </Button>
              {current ? (
                <Button variant="ghost" className="text-neg" onClick={remove} disabled={pending}>
                  Löschen
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        {/* Wirkung */}
        <section className="flex min-w-0 flex-col gap-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-[12px] text-ink-3">Heute, ohne Szenario</p>
              <SafetyScale level={before.level} className="mt-1" />
            </div>
            <div>
              <p className="text-[12px] text-ink-3">Mit Szenario</p>
              <SafetyScale level={after.level} className="mt-1" />
              {after.level !== before.level ? <p className="mt-1 text-[13px] text-ink-2">{after.reasons[0]}</p> : null}
            </div>
          </div>

          <TimelineChart
            height={240}
            series={{
              past: [{ date: input.today, balanceCents: input.openingBalanceCents }],
              future: withScenario.days.map((d) => ({ date: d.date, balanceCents: d.balanceCents })),
              compare: base.days.map((d) => ({ date: d.date, balanceCents: d.balanceCents })),
              futureLabel: "mit Szenario",
              compareLabel: "wie geplant",
            }}
            events={withScenario.events.map((e) => ({ date: e.date, amountCents: e.amountCents, label: e.label }))}
            reserveCents={reserve.reserveCents}
            ariaLabel="Prognose mit und ohne Szenario"
          />

          <Section title="Unterschied">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <Stat label={`Stand in ${days === 365 ? "einem Jahr" : `${days} Tagen`}`} before={end(base)} after={end(withScenario)} />
              <Stat label="Tiefster Stand" before={lowBase.balanceCents} after={lowAfter.balanceCents} note={`am ${formatDayShort(lowAfter.date)}`} />
              <Stat label="Spielraum über Reserve" before={before.headroomCents} after={after.headroomCents} />
            </dl>
            {breach ? (
              <p className="mt-4 text-[14px] text-caution">Am {formatDayShort(breach.date)} fiele dein Stand unter die Reserve von {formatMoney(reserve.reserveCents, { whole: true })}.</p>
            ) : null}
          </Section>

          <Note>
            Die Sandbox nutzt dieselbe Prognose wie die Lage: deine Konten, Fixkosten, Geplantes, Sparraten und variablen Ausgaben – plus
            die Ereignisse links. Gespeichert wird nur das Szenario selbst, nie eine Buchung.
          </Note>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, before, after, note }: { label: string; before: number; after: number; note?: string }) {
  const diff = after - before;
  return (
    <div>
      <dt className="text-[12px] text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-[18px] font-medium">
        <Money cents={after} whole />
      </dd>
      <dd className={cx("num text-[12px]", diff === 0 ? "text-ink-3" : diff > 0 ? "text-pos" : "text-caution")}>
        {diff === 0 ? "unverändert" : `${formatMoney(diff, { signed: true, whole: true })} ggü. Plan`}
        {note ? <span className="ml-1 text-ink-3">· {note}</span> : null}
      </dd>
    </div>
  );
}
