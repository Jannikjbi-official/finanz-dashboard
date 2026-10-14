"use client";

import { Lightning } from "@phosphor-icons/react";
import { Button, Input, Modal, TextField } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { useAction } from "@/lib/client/use-action";
import { parseQuickEntry } from "@/lib/domain/quick-parse";
import { formatAmountInput, formatDayShort, formatMoney } from "@/lib/format";
import { saveTransaction } from "@/lib/server/actions/transactions";
import { useQuickAdd } from "./quick-add";

const EXAMPLE = "-12,50 Lidl gestern @Giro #Lebensmittel";

/**
 * Schnellerfassung in einer Zeile (lib/domain/quick-parse.ts) mit Vorschau.
 * Enter bucht, die Zeile ist danach wieder leer.
 */
export function QuickEntryBar({ autoFocus = false, onDone }: { autoFocus?: boolean; onDone?: () => void }) {
  const { lookups } = useQuickAdd();
  const { run, pending } = useAction();
  const [text, setText] = useState("");
  const entry = useMemo(() => (text.trim() ? parseQuickEntry(text, lookups) : null), [text, lookups]);
  const account = lookups.accounts.find((item) => item.id === entry?.accountId);
  const category = lookups.categories.find((item) => item.id === entry?.categoryId);

  async function submit() {
    if (!entry || entry.problems.length > 0 || entry.amountCents === null || !entry.accountId) return;
    const done = await run(() =>
      saveTransaction({
        type: entry.type,
        status: "booked",
        amount: formatAmountInput(entry.amountCents!),
        date: entry.date,
        title: entry.title,
        note: null,
        categoryId: entry.categoryId,
        accountId: entry.accountId!,
      }),
    );
    if (done) {
      setText("");
      onDone?.();
    }
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="flex gap-2">
        <TextField value={text} onChange={setText} aria-label="Schnellerfassung" fullWidth autoFocus={autoFocus}>
          <Input placeholder={`Schnell erfassen, z. B. ${EXAMPLE}`} autoComplete="off" />
        </TextField>
        <Button type="submit" isPending={pending} isDisabled={!entry || entry.problems.length > 0}>
          Buchen
        </Button>
      </div>
      {entry && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted" aria-live="polite">
          <span className={entry.type === "income" ? "text-success" : ""}>{entry.type === "income" ? "Einnahme" : "Ausgabe"}</span>
          {entry.amountCents !== null && <span className="num text-foreground">{formatMoney(entry.amountCents)}</span>}
          {entry.title && <span className="text-foreground">{entry.title}</span>}
          <span>{entry.date === lookups.today ? "heute" : formatDayShort(entry.date)}</span>
          {account && <span>{account.name}</span>}
          {category && <span>{category.name}</span>}
          {entry.problems.length > 0 && <span className="text-danger">{entry.problems.join(" · ")}</span>}
        </div>
      )}
    </form>
  );
}

/** Strg+K / Cmd+K oeffnet die Schnellerfassung von ueberall. */
export function QuickEntryHotkey() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Modal.Backdrop isOpen={open} onOpenChange={setOpen}>
      <Modal.Container size="md" placement="top">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label="Schließen" />
          <Modal.Header>
            <Modal.Heading className="flex items-center gap-2">
              <Lightning className="size-4 text-accent" /> Schnell erfassen
            </Modal.Heading>
            <p className="label font-normal">
              Betrag mit + für Einnahmen, Datum als heute/gestern/TT.MM., @Konto und #Kategorie. Beispiel: {EXAMPLE}
            </p>
          </Modal.Header>
          <Modal.Body className="pb-5">{open && <QuickEntryBar autoFocus onDone={() => setOpen(false)} />}</Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
