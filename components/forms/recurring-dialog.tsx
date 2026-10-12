"use client";

import { Disclosure } from "@heroui/react";
import { useState } from "react";
import { Figures } from "@/components/ui/money";
import { formatAmountInput, formatMoney } from "@/lib/format";
import { useAction } from "@/lib/client/use-action";
import { COST_TYPE_LABEL, INTERVAL_LABEL, INTERVAL_UNIT } from "@/lib/domain/labels";
import { monthlyEquivalent } from "@/lib/domain/recurring";
import { parseAmountToCents } from "@/lib/money";
import type { CostType, Interval, Recurring, TxType } from "@/lib/domain/types";
import { saveRecurring } from "@/lib/server/actions/recurring";
import { COST_TYPE_ORDER } from "@/lib/domain/commitments";
import { DateInput, MoneyInput, NoteInput, SelectInput, TextInput } from "./fields";
import { FormDialog } from "./form-dialog";
import type { Lookups } from "./transaction-dialog";

const INTERVALS: Interval[] = ["monthly", "yearly", "quarterly", "weekly"];

/**
 * Abo, feste Kosten oder regelmaessige Einnahme anlegen/bearbeiten.
 * Kuendigungsdetails sind optional und eingeklappt - es wird nichts
 * vorausgefuellt, was nicht bekannt ist.
 */
export function RecurringDialog({
  isOpen,
  onOpenChange,
  lookups,
  entry,
  defaults,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  lookups: Lookups;
  entry?: Recurring | null;
  defaults?: { type?: TxType; costType?: CostType };
}) {
  const type: TxType = entry?.type ?? defaults?.type ?? "expense";
  const [title, setTitle] = useState(entry?.title ?? "");
  const [provider, setProvider] = useState(entry?.provider ?? "");
  const [amount, setAmount] = useState(entry ? formatAmountInput(entry.amountCents) : "");
  const [interval, setInterval] = useState<Interval>(entry?.interval ?? "monthly");
  const [nextDue, setNextDue] = useState<string | null>(entry?.nextDue ?? null);
  const [costType, setCostType] = useState<CostType>(entry?.costType ?? defaults?.costType ?? "subscription");
  const [categoryId, setCategoryId] = useState<string | null>(entry?.categoryId ?? null);
  const [accountId, setAccountId] = useState<string | null>(entry?.accountId ?? null);
  const [endDate, setEndDate] = useState<string | null>(entry?.endDate ?? null);
  const [noticeValue, setNoticeValue] = useState(entry?.noticePeriod ? String(entry.noticePeriod.value) : "");
  const [noticeUnit, setNoticeUnit] = useState<string | null>(entry?.noticePeriod?.unit ?? "months");
  const [note, setNote] = useState(entry?.note ?? "");
  const { run, pending } = useAction();

  const isSubscription = type === "expense" && costType === "subscription";
  const cents = parseAmountToCents(amount);
  const perMonth = cents && interval !== "monthly" ? monthlyEquivalent({ amountCents: cents, interval }) : null;

  const noun = type === "income" ? "regelmäßige Einnahme" : isSubscription ? "Abonnement" : "feste Kosten";
  const heading = entry
    ? `${type === "income" ? "Regelmäßige Einnahme" : isSubscription ? "Abonnement" : "Feste Kosten"} bearbeiten`
    : type === "income"
      ? "Regelmäßige Einnahme anlegen"
      : isSubscription
        ? "Abonnement hinzufügen"
        : "Feste Kosten hinzufügen";

  return (
    <FormDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={heading}
      pending={pending}
      onSubmit={() =>
        run(() =>
          saveRecurring({
            id: entry?.id ?? null,
            type,
            title,
            provider,
            amount,
            interval,
            nextDue: nextDue ?? "",
            costType,
            categoryId,
            accountId,
            endDate,
            cancelledOn: entry?.cancelledOn ?? null,
            noticeValue,
            noticeUnit: noticeValue ? (noticeUnit as "days" | "weeks" | "months") : null,
            note,
          }),
        )
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput
          label="Name"
          value={title}
          onChange={setTitle}
          isRequired
          autoFocus
          maxLength={80}
          placeholder={type === "income" ? "z. B. Gehalt" : isSubscription ? "z. B. Musikstreaming" : "z. B. Miete"}
        />
        <TextInput
          label={type === "income" ? "Von (optional)" : "Anbieter (optional)"}
          value={provider}
          onChange={setProvider}
          maxLength={80}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MoneyInput
          label="Betrag pro Zahlung"
          value={amount}
          onChange={setAmount}
          description={perMonth !== null ? `entspricht ${formatMoney(perMonth)} pro Monat` : undefined}
        />
        <SelectInput
          label="Intervall"
          value={interval}
          onChange={(value) => value && setInterval(value as Interval)}
          options={INTERVALS.map((id) => ({ id, label: INTERVAL_LABEL[id] }))}
          isRequired
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DateInput
          label="Nächste Zahlung"
          value={nextDue}
          onChange={setNextDue}
          isRequired
          description={entry ? undefined : `Danach ${INTERVAL_LABEL[interval].toLowerCase()} am gleichen Tag.`}
        />
        {type === "expense" ? (
          <SelectInput
            label="Art"
            value={costType}
            onChange={(value) => value && setCostType(value as CostType)}
            options={COST_TYPE_ORDER.map((id) => ({ id, label: COST_TYPE_LABEL[id] }))}
            isRequired
          />
        ) : (
          <SelectInput
            label="Kategorie"
            value={categoryId}
            onChange={setCategoryId}
            placeholder="Ohne Kategorie"
            options={[
              { id: "none", label: "Ohne Kategorie" },
              ...lookups.categories.filter((c) => c.kind === "income").map((c) => ({ id: c.id, label: c.name })),
            ]}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectInput
          label="Konto"
          value={accountId}
          onChange={setAccountId}
          placeholder="Kein Konto"
          options={[
            { id: "none", label: "Kein Konto" },
            ...lookups.accounts.filter((a) => !a.archived || a.id === entry?.accountId).map((a) => ({ id: a.id, label: a.name })),
          ]}
        />
        {type === "expense" && (
          <SelectInput
            label="Kategorie"
            value={categoryId}
            onChange={setCategoryId}
            placeholder="Ohne Kategorie"
            options={[
              { id: "none", label: "Ohne Kategorie" },
              ...lookups.categories.filter((c) => c.kind === "expense").map((c) => ({ id: c.id, label: c.name })),
            ]}
          />
        )}
      </div>

      {type === "expense" && (
        <Disclosure defaultExpanded={Boolean(entry?.endDate || entry?.noticePeriod)}>
          <Disclosure.Heading>
            <Disclosure.Trigger className="flex w-full items-center justify-between rounded-[var(--radius)] py-1 text-left text-[13px] font-medium text-muted hover:text-foreground">
              Vertrag und Kündigung (optional)
              <Disclosure.Indicator />
            </Disclosure.Trigger>
          </Disclosure.Heading>
          <Disclosure.Content>
            <Disclosure.Body className="flex flex-col gap-4 pt-3">
              <DateInput
                label="Vertragsende"
                value={endDate}
                onChange={setEndDate}
                description="Bei gekündigten Verträgen: bis zu diesem Tag wird noch abgebucht."
              />
              <div className="grid grid-cols-2 gap-4">
                <TextInput label="Kündigungsfrist" value={noticeValue} onChange={(v) => /^\d{0,3}$/.test(v) && setNoticeValue(v)} placeholder="z. B. 1" />
                <SelectInput
                  label="Einheit"
                  value={noticeUnit}
                  onChange={setNoticeUnit}
                  options={[
                    { id: "days", label: "Tage" },
                    { id: "weeks", label: "Wochen" },
                    { id: "months", label: "Monate" },
                  ]}
                />
              </div>
            </Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>
      )}

      <NoteInput value={note} onChange={setNote} />
      {cents && (
        <p className="label font-normal">
          <Figures text={formatMoney(cents)} /> pro {INTERVAL_UNIT[interval]} · als {noun} gespeichert
        </p>
      )}
    </FormDialog>
  );
}
