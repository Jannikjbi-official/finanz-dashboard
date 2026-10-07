"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveAccount, saveRecurring } from "@/lib/actions";
import { completeOnboarding, saveSettings } from "@/lib/server/actions/planning";
import { addMonths, daysInMonth } from "@/lib/domain/calendar";
import { parseSignedAmount } from "@/lib/import";
import { formatMoney } from "@/lib/format";
import { Button } from "@/ui/button";
import { AmountInput, Field, Input, Segmented, Select } from "@/ui/field";
import { FormError } from "@/ui/action-form";
import { Wordmark } from "@/ui/logo";
import { cx } from "@/ui/cx";

type Step = 0 | 1 | 2 | 3 | 4;

const FIXED = [
  { key: "miete", label: "Miete / Wohnen", category: "Wohnen" },
  { key: "strom", label: "Strom & Gas", category: "Wohnen" },
  { key: "internet", label: "Internet & Telefon", category: "Verträge & Abos" },
  { key: "handy", label: "Handyvertrag", category: "Verträge & Abos" },
  { key: "versicherung", label: "Versicherungen", category: "Versicherungen" },
  { key: "mobil", label: "Nahverkehr / Auto", category: "Mobilität" },
  { key: "streaming", label: "Streaming & Abos", category: "Verträge & Abos" },
];

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

export function Onboarding({
  name,
  today,
  categories,
}: {
  name: string;
  today: string;
  categories: Array<{ id: string; name: string; kind: "income" | "expense" }>;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [accountName, setAccountName] = useState("Girokonto");
  const [balance, setBalance] = useState("");
  const [income, setIncome] = useState("");
  const [payday, setPayday] = useState("1");
  const [fixed, setFixed] = useState<Record<string, string>>({});
  const [variable, setVariable] = useState("");
  const [reserveMode, setReserveMode] = useState<"auto" | "custom">("auto");
  const [reserve, setReserve] = useState("");

  const categoryId = (categoryName: string, kind: "income" | "expense") =>
    categories.find((c) => c.kind === kind && c.name === categoryName)?.id ?? "none";

  /** Naechster Termin zum Wunschtag: diesen Monat, wenn noch nicht vorbei, sonst naechsten. */
  function nextDate(day: number) {
    const [y, m] = today.split("-").map(Number);
    const thisMonth = `${today.slice(0, 7)}-${String(Math.min(day, daysInMonth(y, m))).padStart(2, "0")}`;
    return thisMonth >= today ? thisMonth : addMonths(`${today.slice(0, 7)}-01`, 1, day);
  }

  const fixedTotal = Object.values(fixed).reduce((s, v) => s + Math.abs(parseSignedAmount(v) ?? 0), 0);

  function run(work: () => Promise<string | null>, next: Step) {
    setError(null);
    startTransition(async () => {
      const failure = await work();
      if (failure) setError(failure);
      else setStep(next);
    });
  }

  const saveAccountStep = () =>
    run(async () => {
      const result = await saveAccount(
        { ok: false },
        form({ name: accountName.trim() || "Girokonto", kind: "giro", startBalance: balance, color: "#0d5a5c", liquidField: "1", liquid: "true" }),
      );
      return result.ok ? null : (result.error ?? "Konto konnte nicht angelegt werden");
    }, 2);

  const saveIncomeStep = () =>
    run(async () => {
      if (!income.trim()) return null;
      const result = await saveRecurring(
        { ok: false },
        form({ type: "income", interval: "monthly", amount: income, title: "Gehalt", startDate: nextDate(Number(payday)), categoryId: categoryId("Gehalt", "income") }),
      );
      return result.ok ? null : (result.error ?? "Einkommen konnte nicht gespeichert werden");
    }, 3);

  const saveFixedStep = () =>
    run(async () => {
      for (const item of FIXED) {
        const value = fixed[item.key];
        if (!value?.trim()) continue;
        const result = await saveRecurring(
          { ok: false },
          form({ type: "expense", interval: "monthly", amount: value, title: item.label.split(" / ")[0], startDate: nextDate(1), categoryId: categoryId(item.category, "expense") }),
        );
        if (!result.ok) return `${item.label}: ${result.error ?? "nicht gespeichert"}`;
      }
      if (variable.trim()) {
        const result = await saveSettings({ ok: false }, form({ variableEstimate: variable }));
        if (!result.ok) return result.error ?? "Alltagsausgaben ungültig";
      }
      return null;
    }, 4);

  const finish = () =>
    run(async () => {
      const settings = await saveSettings({ ok: false }, form(reserveMode === "auto" ? { reserveMode: "auto" } : { reserveMode: "custom", reserve }));
      if (!settings.ok) return settings.error ?? "Reserve ungültig";
      await completeOnboarding();
      router.push("/app");
      router.refresh();
      return null;
    }, 4);

  const skip = () =>
    startTransition(async () => {
      await completeOnboarding();
      router.push("/app");
      router.refresh();
    });

  const STEPS = ["Willkommen", "Konto", "Einkommen", "Fixkosten", "Reserve"];

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-8 sm:py-14">
      <div className="flex items-center justify-between">
        <Wordmark />
        <button type="button" onClick={skip} className="text-[13px] text-ink-3 hover:text-ink">
          Überspringen
        </button>
      </div>

      <ol className="mt-10 flex gap-1.5" aria-label="Fortschritt">
        {STEPS.map((label, index) => (
          <li key={label} className={cx("h-1 flex-1 rounded-full", index <= step ? "bg-ink" : "bg-line")} aria-current={index === step ? "step" : undefined}>
            <span className="sr-only">{label}</span>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex-1">
        {step === 0 ? (
          <section className="flex flex-col gap-4">
            <h1 className="font-serif text-[34px] leading-tight">Hallo{name ? ` ${name.split(" ")[0]}` : ""}.</h1>
            <p className="text-[16px] leading-relaxed text-ink-2">
              In vier kurzen Schritten weiß die App genug, um dir zu zeigen, wie es um dein Geld steht – und wie es in den nächsten 90 Tagen
              weitergeht. Alles lässt sich später ändern.
            </p>
            <ul className="mt-2 flex flex-col gap-2 text-[14px] text-ink-2">
              <li>1. Dein Konto mit dem heutigen Stand</li>
              <li>2. Dein regelmäßiges Einkommen</li>
              <li>3. Deine festen Kosten</li>
              <li>4. Wie viel Puffer immer bleiben soll</li>
            </ul>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="flex flex-col gap-5">
            <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Wo liegt dein Geld?</h1>
            <p className="text-[15px] text-ink-2">Fang mit deinem Hauptkonto an. Weitere Konten, Bargeld und Sparkonten kannst du später ergänzen.</p>
            <Field label="Name" htmlFor="ob-account">
              <Input id="ob-account" value={accountName} onChange={(e) => setAccountName(e.target.value)} maxLength={40} />
            </Field>
            <Field label="Kontostand heute" htmlFor="ob-balance" hint="Schau kurz in deine Banking-App. Bei Minus mit Minuszeichen.">
              <AmountInput id="ob-balance" value={balance} onChange={(e) => setBalance(e.target.value)} autoFocus />
            </Field>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="flex flex-col gap-5">
            <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Was kommt regelmäßig rein?</h1>
            <p className="text-[15px] text-ink-2">Dein Nettogehalt oder eine andere feste Einnahme. Ohne sie kennt die Prognose nur Ausgaben.</p>
            <div className="grid grid-cols-[1fr_9rem] gap-3">
              <Field label="Betrag pro Monat" htmlFor="ob-income">
                <AmountInput id="ob-income" value={income} onChange={(e) => setIncome(e.target.value)} autoFocus />
              </Field>
              <Field label="Kommt am" htmlFor="ob-payday">
                <Select id="ob-payday" value={payday} onChange={(e) => setPayday(e.target.value)}>
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}.
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <p className="text-[13px] text-ink-3">Kein festes Einkommen? Einfach leer lassen und weiter.</p>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="flex flex-col gap-5">
            <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Was geht jeden Monat fest ab?</h1>
            <p className="text-[15px] text-ink-2">Grobe Beträge reichen. Leer gelassene Zeilen werden übersprungen; Termine passt du später unter Fixkosten an.</p>
            <ul className="flex flex-col">
              {FIXED.map((item) => (
                <li key={item.key} className="grid grid-cols-[1fr_9rem] items-center gap-3 border-b border-line py-2">
                  <label htmlFor={`ob-${item.key}`} className="text-[14px]">
                    {item.label}
                  </label>
                  <AmountInput id={`ob-${item.key}`} value={fixed[item.key] ?? ""} onChange={(e) => setFixed((f) => ({ ...f, [item.key]: e.target.value }))} />
                </li>
              ))}
            </ul>
            <p className="text-right text-[14px] text-ink-2">
              Zusammen <span className="num font-medium text-ink">{formatMoney(fixedTotal)}</span> pro Monat
            </p>
            <Field
              label="Und für den Alltag?"
              htmlFor="ob-variable"
              hint="Lebensmittel, Freizeit, Kleinkram – grob pro Monat. Sobald ein voller Monat erfasst ist, rechnet die App mit deinen echten Werten."
            >
              <AmountInput id="ob-variable" value={variable} onChange={(e) => setVariable(e.target.value)} className="max-w-48" />
            </Field>
          </section>
        ) : null}

        {step === 4 ? (
          <section className="flex flex-col gap-5">
            <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Wie viel soll immer bleiben?</h1>
            <p className="text-[15px] text-ink-2">
              Die Mindestreserve ist dein Puffer für Unvorhergesehenes. Fällt dein Stand darunter, siehst du das sofort – samt Begründung.
            </p>
            <Segmented
              name="ob-reserve"
              value={reserveMode}
              onChange={setReserveMode}
              options={[
                { value: "auto", label: "Ein Monat Fixkosten" },
                { value: "custom", label: "Eigener Betrag" },
              ]}
            />
            {reserveMode === "auto" ? (
              <p className="text-[14px] text-ink-2">Aktuell wären das {formatMoney(fixedTotal)} – der Wert wächst mit deinen Fixkosten mit.</p>
            ) : (
              <Field label="Mindestreserve" htmlFor="ob-reserve-amount">
                <AmountInput id="ob-reserve-amount" value={reserve} onChange={(e) => setReserve(e.target.value)} className="max-w-48" autoFocus />
              </Field>
            )}
          </section>
        ) : null}

        <div className="mt-6">
          <FormError error={error} />
        </div>
      </div>

      <div className="mt-10 flex items-center justify-between border-t border-line pt-5">
        {step > 0 ? (
          <Button variant="ghost" onClick={() => setStep((s) => (s - 1) as Step)} disabled={pending}>
            Zurück
          </Button>
        ) : (
          <span />
        )}
        {step === 0 ? <Button variant="primary" onClick={() => setStep(1)}>Los geht’s</Button> : null}
        {step === 1 ? <Button variant="primary" onClick={saveAccountStep} pending={pending}>Weiter</Button> : null}
        {step === 2 ? <Button variant="primary" onClick={saveIncomeStep} pending={pending}>{income.trim() ? "Weiter" : "Ohne Einkommen weiter"}</Button> : null}
        {step === 3 ? <Button variant="primary" onClick={saveFixedStep} pending={pending}>Weiter</Button> : null}
        {step === 4 ? <Button variant="primary" onClick={finish} pending={pending}>Fertig – zur Lage</Button> : null}
      </div>
    </div>
  );
}
