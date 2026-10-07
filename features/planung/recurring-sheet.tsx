"use client";

import { useState } from "react";
import { deleteRecurring, saveRecurring } from "@/lib/actions";
import { ActionForm, FormError } from "@/ui/action-form";
import { Button } from "@/ui/button";
import { AmountInput, Checkbox, Field, Input, Segmented, Select, Textarea } from "@/ui/field";
import { Confirm, Sheet } from "@/ui/sheet";
import { useToast } from "@/ui/toast";
import { centsToInput, type CategoryOption } from "@/features/shared/types";

export type RecurringView = {
  id: string;
  type: "income" | "expense";
  title: string;
  amountCents: number;
  interval: "weekly" | "monthly" | "quarterly" | "yearly";
  startDate: string;
  nextDue: string;
  active: boolean;
  categoryId: string | null;
  note: string | null;
};

export const INTERVAL_OPTIONS = [
  { value: "monthly", label: "Monatlich" },
  { value: "quarterly", label: "Vierteljährlich" },
  { value: "yearly", label: "Jährlich" },
  { value: "weekly", label: "Wöchentlich" },
] as const;

export function RecurringSheet({
  open,
  onOpenChange,
  entry,
  categories,
  today,
  defaultType = "expense",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: RecurringView | null;
  categories: CategoryOption[];
  today: string;
  defaultType?: "income" | "expense";
}) {
  const [type, setType] = useState<"income" | "expense">(entry?.type ?? defaultType);
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();
  const formId = entry ? `rec-${entry.id}` : "rec-new";

  async function remove() {
    const data = new FormData();
    data.set("id", entry!.id);
    const result = await deleteRecurring({ ok: false }, data);
    setConfirm(false);
    toast(result.ok ? (result.message ?? "Gelöscht") : (result.error ?? "Fehler"), result.ok ? "ok" : "error");
    if (result.ok) onOpenChange(false);
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        title={entry ? "Regelmäßige Zahlung bearbeiten" : "Regelmäßige Zahlung anlegen"}
        description="Abos, Verträge, Versicherungen, Miete – oder dein Gehalt."
        footer={
          <div className="flex items-center justify-between gap-2">
            {entry ? (
              <Button variant="ghost" className="text-neg" onClick={() => setConfirm(true)}>
                Löschen
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button variant="primary" type="submit" form={formId}>
                Speichern
              </Button>
            </div>
          </div>
        }
      >
        <ActionForm id={formId} action={saveRecurring} onSuccess={() => onOpenChange(false)} className="flex flex-col gap-5">
          {({ error }) => (
            <>
              {entry ? <input type="hidden" name="id" value={entry.id} /> : null}
              <input type="hidden" name="type" value={type} />

              <Segmented
                name="rec-type"
                value={type}
                onChange={setType}
                className="w-full"
                options={[
                  { value: "expense", label: "Ausgabe" },
                  { value: "income", label: "Einnahme" },
                ]}
              />

              <div className="grid grid-cols-[1fr_9rem] gap-3">
                <Field label="Bezeichnung" htmlFor="rec-title">
                  <Input id="rec-title" name="title" required maxLength={80} defaultValue={entry?.title} placeholder={type === "expense" ? "z. B. Handyvertrag" : "z. B. Gehalt"} />
                </Field>
                <Field label="Betrag" htmlFor="rec-amount">
                  <AmountInput id="rec-amount" name="amount" required defaultValue={centsToInput(entry?.amountCents)} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Rhythmus" htmlFor="rec-interval">
                  <Select id="rec-interval" name="interval" defaultValue={entry?.interval ?? "monthly"}>
                    {INTERVAL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Erste Zahlung" htmlFor="rec-start" hint="Daraus folgen alle weiteren Termine.">
                  <Input id="rec-start" type="date" name="startDate" required defaultValue={entry?.startDate ?? today} />
                </Field>
              </div>

              <Field label="Kategorie" htmlFor="rec-category">
                <Select id="rec-category" name="categoryId" defaultValue={entry?.categoryId ?? "none"} key={type}>
                  <option value="none">Ohne Kategorie</option>
                  {categories
                    .filter((category) => category.kind === type)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </Select>
              </Field>

              <Field label="Notiz" htmlFor="rec-note" optional>
                <Textarea id="rec-note" name="note" rows={2} maxLength={300} defaultValue={entry?.note ?? ""} placeholder="z. B. Kündigungsfrist 3 Monate" />
              </Field>

              {entry ? (
                <Checkbox name="active" value="false" defaultChecked={!entry.active} label="Pausiert – zählt nicht in Fixkosten und Prognose" />
              ) : null}

              <FormError error={error} />
            </>
          )}
        </ActionForm>
      </Sheet>

      <Confirm open={confirm} onOpenChange={setConfirm} title="Regelmäßige Zahlung löschen?" description="Bereits erfasste Buchungen bleiben erhalten.">
        <Button variant="ghost" onClick={() => setConfirm(false)}>
          Abbrechen
        </Button>
        <Button variant="danger" onClick={remove}>
          Löschen
        </Button>
      </Confirm>
    </>
  );
}
