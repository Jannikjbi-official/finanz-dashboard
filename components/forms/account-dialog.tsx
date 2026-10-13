"use client";

import { Description, Switch } from "@heroui/react";
import { useState } from "react";
import { useQuickAdd } from "@/components/shell/quick-add";
import { formatAmountInput, formatDate, formatMoney } from "@/lib/format";
import { useAction } from "@/lib/client/use-action";
import { ACCOUNT_KIND_LABEL } from "@/lib/domain/labels";
import type { Account, AccountKind } from "@/lib/domain/types";
import { saveAccount } from "@/lib/server/actions/accounts";
import { DateInput, MoneyInput, SelectInput, TextInput } from "./fields";
import { FormDialog } from "./form-dialog";

const KINDS: AccountKind[] = ["giro", "savings", "cash", "paypal", "other"];

export function AccountDialog({
  isOpen,
  onOpenChange,
  account,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account | null;
}) {
  const [name, setName] = useState(account?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? "giro");
  const { lookups } = useQuickAdd();
  const anchor = account?.balanceAnchor ?? null;
  const [startBalance, setStartBalance] = useState(account ? formatAmountInput(account.startBalanceCents) : "");
  const [balance, setBalance] = useState(anchor ? formatAmountInput(anchor.amountCents) : "");
  const [balanceDate, setBalanceDate] = useState<string | null>(anchor?.date ?? lookups.today);
  // Ohne Kontostand mit Datum rechnet ein bestehendes Konto weiter mit dem Anfangssaldo
  const legacy = Boolean(account) && !anchor;
  const [liquid, setLiquid] = useState(account?.liquid ?? true);
  const [liquidTouched, setLiquidTouched] = useState(Boolean(account));
  const { run, pending } = useAction();

  return (
    <FormDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={account ? "Konto bearbeiten" : "Konto anlegen"}
      pending={pending}
      onSubmit={() =>
        run(() =>
          saveAccount({
            id: account?.id ?? null,
            name,
            kind,
            liquid,
            balance,
            balanceDate,
            startBalance: legacy && !balance.trim() ? startBalance : undefined,
          }),
        )
      }
    >
      <TextInput label="Name" value={name} onChange={setName} isRequired autoFocus maxLength={60} placeholder="z. B. Girokonto Sparkasse" />
      <SelectInput
        label="Kontoart"
        value={kind}
        onChange={(value) => {
          if (!value) return;
          setKind(value as AccountKind);
          // Sparkonten zaehlen standardmaessig nicht zum verfuegbaren Geld
          if (!liquidTouched) setLiquid(value !== "savings");
        }}
        options={KINDS.map((id) => ({ id, label: ACCOUNT_KIND_LABEL[id] }))}
        isRequired
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MoneyInput label="Kontostand laut Bank" value={balance} onChange={setBalance} isRequired={false} allowNegative />
        <DateInput label="Stand am" value={balanceDate} onChange={setBalanceDate} />
      </div>
      <p className="label -mt-2 font-normal">
        {anchor
          ? `Zuletzt abgeglichen: ${formatMoney(anchor.amountCents)} am ${formatDate(anchor.date)}. `
          : account
            ? "Leer lassen, um wie bisher mit dem Anfangssaldo zu rechnen. "
            : "Dein Kontostand, z. B. von heute. Bei Überziehung mit Minus. "}
        Ältere Umsätze, die du später importierst, ändern diesen Stand nicht – neuere kommen dazu.
      </p>
      {legacy && !balance.trim() && (
        <MoneyInput
          label="Anfangssaldo (vor der ersten Buchung)"
          value={startBalance}
          onChange={setStartBalance}
          isRequired={false}
          allowNegative
        />
      )}
      <Switch
        isSelected={liquid}
        onChange={(value) => {
          setLiquid(value);
          setLiquidTouched(true);
        }}
        size="sm"
      >
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Zählt zum verfügbaren Geld
        </Switch.Content>
        <Description>Aus, wenn das Guthaben nicht für laufende Ausgaben gedacht ist (z. B. Rücklagen).</Description>
      </Switch>
    </FormDialog>
  );
}
