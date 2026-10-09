"use client";

import { useState } from "react";
import { deleteAccount, saveAccount, transferBetweenAccounts } from "@/lib/actions";
import { ActionForm, FormError } from "@/ui/action-form";
import { Button } from "@/ui/button";
import { AmountInput, Checkbox, Field, Input, Select } from "@/ui/field";
import { Confirm, Sheet } from "@/ui/sheet";
import { useToast } from "@/ui/toast";
import { centsToInput } from "@/features/shared/types";

export type AccountView = {
  id: string;
  name: string;
  kind: "giro" | "cash" | "savings" | "other";
  color: string;
  liquid: boolean;
  archived: boolean;
  startBalanceCents: number;
  balanceCents: number;
  transactionCount: number;
};

const KIND_OPTIONS = [
  { value: "giro", label: "Girokonto" },
  { value: "cash", label: "Bargeld" },
  { value: "savings", label: "Spar- oder Tagesgeldkonto" },
  { value: "other", label: "Sonstiges" },
] as const;

const COLORS = ["#c6f24e", "#6ee7d8", "#8b9cff", "#ff9a52", "#f472b6", "#f5c451", "#9aa3ad"];

export function AccountSheet({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: AccountView | null;
}) {
  const [kind, setKind] = useState<AccountView["kind"]>(account?.kind ?? "giro");
  const [liquid, setLiquid] = useState(account?.liquid ?? true);
  const [color, setColor] = useState(account?.color && COLORS.includes(account.color) ? account.color : COLORS[0]);
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();
  const formId = account ? `account-${account.id}` : "account-new";

  async function remove() {
    const data = new FormData();
    data.set("id", account!.id);
    const result = await deleteAccount({ ok: false }, data);
    setConfirm(false);
    toast(result.ok ? (result.message ?? "Gelöscht") : (result.error ?? "Fehler"), result.ok ? "ok" : "error");
    if (result.ok) onOpenChange(false);
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        title={account ? "Konto bearbeiten" : "Konto anlegen"}
        footer={
          <div className="flex items-center justify-between gap-2">
            {account ? (
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
        <ActionForm id={formId} action={saveAccount} onSuccess={() => onOpenChange(false)} className="flex flex-col gap-5">
          {({ error }) => (
            <>
              {account ? <input type="hidden" name="id" value={account.id} /> : null}
              <input type="hidden" name="color" value={color} />
              <input type="hidden" name="liquidField" value="1" />
              <input type="hidden" name="liquid" value={String(liquid)} />

              <Field label="Name" htmlFor="acc-name">
                <Input id="acc-name" name="name" required maxLength={40} defaultValue={account?.name} placeholder="z. B. Girokonto Sparkasse" autoFocus={!account} />
              </Field>

              <Field label="Art" htmlFor="acc-kind">
                <Select
                  id="acc-kind"
                  name="kind"
                  value={kind}
                  onChange={(event) => {
                    const next = event.target.value as AccountView["kind"];
                    setKind(next);
                    if (!account) setLiquid(next !== "savings");
                  }}
                >
                  {KIND_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Startsaldo"
                htmlFor="acc-start"
                hint={
                  account
                    ? `Stand vor der ersten erfassten Buchung. Aktuell ergibt das ${(account.balanceCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}.`
                    : "Der heutige Kontostand. Bei überzogenem Konto mit Minus eingeben."
                }
              >
                <AmountInput id="acc-start" name="startBalance" defaultValue={account ? centsToInput(account.startBalanceCents) : ""} placeholder="0,00" />
              </Field>

              <Checkbox
                label={
                  <>
                    <span className="font-medium text-ink">Zählt zum verfügbaren Geld</span>
                    <span className="block text-[13px] text-ink-3">
                      Fließt in Lage, Prognose und Sicherheitszone ein. Bei Rücklagen ausschalten.
                    </span>
                  </>
                }
                checked={liquid}
                onChange={(event) => setLiquid(event.target.checked)}
              />

              <fieldset>
                <legend className="mb-2 text-[13px] font-medium text-ink-2">Farbe</legend>
                <div className="flex gap-2">
                  {COLORS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-label={`Farbe ${value}`}
                      aria-pressed={color === value}
                      onClick={() => setColor(value)}
                      className="size-7 rounded-xs ring-offset-2 ring-offset-paper aria-pressed:ring-2 aria-pressed:ring-ink"
                      style={{ background: value }}
                    />
                  ))}
                </div>
              </fieldset>

              {account ? (
                <Checkbox name="archived" value="true" defaultChecked={account.archived} label="Archiviert – erscheint nicht mehr in Auswahllisten" />
              ) : null}

              <FormError error={error} />
            </>
          )}
        </ActionForm>
      </Sheet>

      <Confirm
        open={confirm}
        onOpenChange={setConfirm}
        title="Konto löschen?"
        description={
          account && account.transactionCount > 0
            ? `Die ${account.transactionCount} Buchungen bleiben erhalten, verlieren aber ihre Kontozuordnung. Zum Ausblenden lieber archivieren.`
            : "Das Konto wird entfernt."
        }
      >
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

export function TransferSheet({
  open,
  onOpenChange,
  accounts,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountView[];
  today: string;
}) {
  const active = accounts.filter((account) => !account.archived);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Umbuchen"
      description="Geld zwischen deinen Konten verschieben. Zählt weder als Einnahme noch als Ausgabe."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button variant="primary" type="submit" form="transfer">
            Umbuchen
          </Button>
        </div>
      }
    >
      <ActionForm id="transfer" action={transferBetweenAccounts} onSuccess={() => onOpenChange(false)} className="flex flex-col gap-5">
        {({ error }) => (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Von" htmlFor="tr-from">
                <Select id="tr-from" name="from" defaultValue={active[0]?.id}>
                  {active.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Nach" htmlFor="tr-to">
                <Select id="tr-to" name="to" defaultValue={active[1]?.id ?? active[0]?.id}>
                  {active.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Betrag" htmlFor="tr-amount">
                <AmountInput id="tr-amount" name="amount" required />
              </Field>
              <Field label="Datum" htmlFor="tr-date">
                <Input id="tr-date" type="date" name="date" defaultValue={today} required />
              </Field>
            </div>
            <FormError error={error} />
          </>
        )}
      </ActionForm>
    </Sheet>
  );
}
