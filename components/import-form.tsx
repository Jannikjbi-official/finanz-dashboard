"use client";

import { useActionState, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";
import { importTransactions, type ImportState } from "@/lib/actions";
import type { Account } from "@/lib/types";

const INITIAL: ImportState = { ok: true };

export function ImportForm({ accounts }: { accounts: Account[] }) {
  const [state, formAction, pending] = useActionState(
    importTransactions,
    INITIAL,
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [createCategories, setCreateCategories] = useState(true);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input
        type="hidden"
        name="createCategories"
        value={String(createCategories)}
      />

      {state.error ? (
        <Alert color="danger" variant="flat" title={state.error} />
      ) : null}

      {state.ok && state.message ? (
        <Alert
          color="success"
          variant="flat"
          title={state.message}
          description={[
            state.skipped ? `${state.skipped} Zeilen übersprungen` : null,
            state.createdCategories?.length
              ? `Neue Kategorien: ${state.createdCategories.join(", ")}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        />
      ) : null}

      {state.problems?.length ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-3">
          <p className="text-tiny font-medium text-warning">
            Nicht importierte Zeilen
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {state.problems.map((problem) => (
              <li key={problem.line} className="text-tiny text-default-500">
                Zeile {problem.line}: {problem.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <label className="flex cursor-pointer flex-col gap-2 rounded-2xl border border-dashed border-default-200 p-5 text-center transition-colors hover:border-primary/50">
        <span className="text-sm">
          {fileName ?? "CSV-Datei auswählen"}
        </span>
        <span className="text-tiny text-default-400">
          Spalten: Datum, Bezeichnung, Betrag, Typ, Kategorie, Notiz
        </span>
        <input
          type="file"
          name="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={(event) =>
            setFileName(event.target.files?.[0]?.name ?? null)
          }
        />
      </label>

      <Textarea
        name="csv"
        label="… oder CSV hier einfügen"
        variant="bordered"
        minRows={4}
        placeholder={"Datum;Bezeichnung;Betrag;Typ;Kategorie\n01.09.2026;Einkauf;42,50;Ausgabe;Lebensmittel"}
      />

      <div className="flex flex-wrap items-center gap-4">
        {accounts.length > 0 ? (
          <Select
            name="accountId"
            label="Konto zuordnen"
            variant="bordered"
            size="sm"
            className="max-w-xs"
            defaultSelectedKeys={["none"]}
          >
            {[{ id: "none", name: "Ohne Konto" }, ...accounts].map((account) => (
              <SelectItem key={account.id} textValue={account.name}>
                {account.name}
              </SelectItem>
            ))}
          </Select>
        ) : null}

        <Checkbox
          size="sm"
          isSelected={createCategories}
          onValueChange={setCreateCategories}
        >
          Unbekannte Kategorien anlegen
        </Checkbox>
      </div>

      <Button color="primary" type="submit" isLoading={pending} className="self-start">
        Importieren
      </Button>
    </form>
  );
}
