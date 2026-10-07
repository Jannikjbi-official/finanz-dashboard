"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { saveSettings } from "@/lib/server/actions/planning";
import { ActionForm, FormError } from "@/ui/action-form";
import { Button } from "@/ui/button";
import { AmountInput, Field, Input, Segmented, Select } from "@/ui/field";
import { useToast } from "@/ui/toast";
import { centsToInput } from "@/features/shared/types";

export function ProfileForm({ name }: { name: string }) {
  const [value, setValue] = useState(name);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const { error } = await authClient.updateUser({ name: value.trim().slice(0, 60) });
          if (error) toast(error.message ?? "Speichern fehlgeschlagen", "error");
          else {
            toast("Name gespeichert");
            router.refresh();
          }
        });
      }}
    >
      <Field label="Name" htmlFor="profile-name" className="flex-1">
        <Input id="profile-name" value={value} onChange={(e) => setValue(e.target.value)} maxLength={60} required />
      </Field>
      <Button type="submit" pending={pending} disabled={!value.trim() || value === name}>
        Speichern
      </Button>
    </form>
  );
}

export function ReserveForm({
  reserveCents,
  fixedMonthlyCents,
}: {
  reserveCents: number | null;
  fixedMonthlyCents: number;
}) {
  const [mode, setMode] = useState<"auto" | "custom">(reserveCents === null ? "auto" : "custom");
  return (
    <ActionForm action={saveSettings} className="flex flex-col gap-4">
      {({ error, pending }) => (
        <>
          <input type="hidden" name="reserveMode" value={mode} />
          <Segmented
            name="reserve-mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "auto", label: "Automatisch" },
              { value: "custom", label: "Eigener Betrag" },
            ]}
          />
          {mode === "auto" ? (
            <p className="text-[14px] text-ink-2">
              Ein Monat Fixkosten – aktuell {(fixedMonthlyCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}. Passt sich an,
              wenn sich deine Fixkosten ändern.
            </p>
          ) : (
            <Field label="Mindestreserve" htmlFor="reserve" hint="Dieser Betrag soll auf deinen verfügbaren Konten nie unterschritten werden.">
              <AmountInput id="reserve" name="reserve" defaultValue={centsToInput(reserveCents ?? fixedMonthlyCents)} className="max-w-48" />
            </Field>
          )}
          <FormError error={error} />
          <Button type="submit" pending={pending} className="self-start">
            Speichern
          </Button>
        </>
      )}
    </ActionForm>
  );
}

export function VariableEstimateForm({ estimateCents, basisMonths }: { estimateCents: number | null; basisMonths: number }) {
  return (
    <ActionForm action={saveSettings} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      {({ error, pending }) => (
        <>
          <Field
            label="Alltagsausgaben pro Monat (Schätzung)"
            htmlFor="variable-estimate"
            className="flex-1"
            hint={
              basisMonths > 0
                ? `Wird gerade nicht gebraucht: Die Prognose nutzt schon den Durchschnitt aus ${basisMonths} ${basisMonths === 1 ? "Monat" : "Monaten"} echter Buchungen.`
                : "Lebensmittel, Freizeit, Kleinkram – alles ohne Fixkosten. Gilt, bis ein voller Monat mit Buchungen vorliegt."
            }
          >
            <AmountInput id="variable-estimate" name="variableEstimate" defaultValue={centsToInput(estimateCents)} className="max-w-48" />
          </Field>
          <Button type="submit" pending={pending}>
            Speichern
          </Button>
          <FormError error={error} />
        </>
      )}
    </ActionForm>
  );
}

const COMMON_ZONES =["Europe/Berlin", "Europe/Vienna", "Europe/Zurich", "Europe/London", "Europe/Paris", "Europe/Madrid", "America/New_York", "Asia/Dubai"];

export function TimeZoneForm({ timeZone }: { timeZone: string }) {
  const zones = [...new Set([timeZone, ...COMMON_ZONES])];
  return (
    <ActionForm action={saveSettings} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      {({ error, pending }) => (
        <>
          <Field label="Zeitzone" htmlFor="tz" hint="Bestimmt, wann für dich „heute“ beginnt." className="flex-1">
            <Select id="tz" name="timeZone" defaultValue={timeZone}>
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replace("_", " ")}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" pending={pending}>
            Speichern
          </Button>
          <FormError error={error} />
        </>
      )}
    </ActionForm>
  );
}
