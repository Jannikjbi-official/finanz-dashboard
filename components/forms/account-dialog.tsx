"use client";

import { Description, Switch } from "@heroui/react";
import { useState } from "react";
import { formatAmountInput } from "@/lib/format";
import { useAction } from "@/lib/client/use-action";
import { ACCOUNT_KIND_LABEL } from "@/lib/domain/labels";
import type { Account, AccountKind } from "@/lib/domain/types";
import { saveAccount } from "@/lib/server/actions/accounts";
import { MoneyInput, SelectInput, TextInput } from "./fields";
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
  const [startBalance, setStartBalance] = useState(account ? formatAmountInput(account.startBalanceCents) : "");
  const [liquid, setLiquid] = useState(account?.liquid ?? true);
  const [liquidTouched, setLiquidTouched] = useState(Boolean(account));
  const { run, pending } = useAction();

  return (
    <FormDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={account ? "Konto bearbeiten" : "Konto anlegen"}
      pending={pending}
      onSubmit={() => run(() => saveAccount({ id: account?.id ?? null, name, kind, startBalance, liquid }))}
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
      <MoneyInput
        label="Anfangssaldo"
        value={startBalance}
        onChange={setStartBalance}
        isRequired={false}
        allowNegative
        description="Kontostand vor der ersten Buchung, die du hier erfasst. Bei Überziehung mit Minus."
      />
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
