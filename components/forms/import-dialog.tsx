"use client";

import { Checkbox, toast } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Figures } from "@/components/ui/money";
import type { Account } from "@/lib/domain/types";
import { formatDate, formatMoney } from "@/lib/format";
import {
  FIELD_LABEL,
  guessMapping,
  MAX_IMPORT_BYTES,
  mappingProblems,
  mapRows,
  parseTable,
  type ImportField,
  type ImportMapping,
  type Table,
} from "@/lib/import";
import { findExistingImportKeys, importTransactions } from "@/lib/server/actions/import";
import { SelectInput } from "./fields";
import { FormDialog } from "./form-dialog";

const FIELDS: ImportField[] = ["date", "title", "amount", "debit", "credit", "type", "category", "note"];

/**
 * CSV-Import: Datei lesen, Spalten zuordnen (automatisch erkannt, aenderbar),
 * Vorschau mit Dublettenpruefung, dann in ein Konto uebernehmen.
 */
export function ImportDialog({
  isOpen,
  onOpenChange,
  accounts,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
}) {
  const router = useRouter();
  const active = accounts.filter((account) => !account.archived);
  const [fileName, setFileName] = useState<string | null>(null);
  const [table, setTable] = useState<Table | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [accountId, setAccountId] = useState<string | null>(active.find((a) => a.kind === "giro")?.id ?? active[0]?.id ?? null);
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => (table ? mapRows(table, mapping) : []), [table, mapping]);
  const problems = table ? mappingProblems(mapping) : [];
  const valid = rows.filter((row) => !row.error);

  // Dubletten gegen vorhandene Buchungen pruefen, sobald die Zuordnung steht
  useEffect(() => {
    const keys = valid.map((row) => row.key);
    if (keys.length === 0) return;
    let cancelled = false;
    findExistingImportKeys(keys).then((found) => {
      if (cancelled) return;
      const set = new Set(found);
      setExisting(set);
      setExcluded(new Set(valid.filter((row) => set.has(row.key)).map((row) => row.line)));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  async function readFile(file: File) {
    setError(null);
    if (file.size > MAX_IMPORT_BYTES) {
      setError("Die Datei ist größer als 2 MB. Bitte exportiere einen kürzeren Zeitraum.");
      return;
    }
    const buffer = await file.arrayBuffer();
    // Banken liefern UTF-8 oder Windows-1252
    let text = new TextDecoder("utf-8").decode(buffer);
    if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buffer);
    const parsed = parseTable(text);
    if (parsed.header.length === 0 || parsed.rows.length === 0) {
      setError("In der Datei wurden keine Zeilen gefunden.");
      return;
    }
    setFileName(file.name);
    setTable(parsed);
    setMapping(guessMapping(parsed.header));
    setExisting(new Set());
    setExcluded(new Set());
  }

  const selected = valid.filter((row) => !excluded.has(row.line));

  async function submit() {
    if (!table) return false;
    if (problems.length > 0) {
      setError(problems.join(" "));
      return false;
    }
    if (!accountId) {
      setError("Bitte ein Konto wählen.");
      return false;
    }
    setPending(true);
    try {
      const result = await importTransactions({
        accountId,
        rows: selected.map((row) => ({
          date: row.date!,
          title: row.title,
          amountCents: row.amountCents,
          type: row.type,
          category: row.category,
          note: row.note,
        })),
      });
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      toast.success(result.message);
      router.refresh();
      return true;
    } finally {
      setPending(false);
    }
  }

  const columnOptions = table
    ? [{ id: "none", label: "– nicht verwenden –" }, ...table.header.map((name, index) => ({ id: String(index), label: name || `Spalte ${index + 1}` }))]
    : [];

  return (
    <FormDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="CSV importieren"
      description="Umsätze aus dem Export deiner Bank übernehmen. Es wird nichts geschätzt: nicht lesbare Zeilen werden übersprungen."
      size="lg"
      submitLabel={selected.length > 0 ? `${selected.length} Buchungen importieren` : "Importieren"}
      pending={pending}
      onSubmit={submit}
    >
      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-[var(--radius)] border border-dashed border-border px-4 py-6 text-center hover:bg-surface-secondary">
        <span className="font-medium">{fileName ?? "CSV-Datei auswählen"}</span>
        <span className="label font-normal">Trennzeichen, Kopfzeile und Datumsformat werden erkannt. Höchstens 2 MB.</span>
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
          }}
        />
      </label>

      {error && <p className="rounded-[var(--radius)] bg-danger-soft px-3 py-2 text-[13px] text-danger-soft-foreground">{error}</p>}

      {table && (
        <>
          <SelectInput
            label="In Konto importieren"
            value={accountId}
            onChange={setAccountId}
            options={active.map((a) => ({ id: a.id, label: a.name }))}
            isRequired
          />
          <div>
            <div className="label mb-2">Spaltenzuordnung</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FIELDS.map((field) => (
                <SelectInput
                  key={field}
                  label={FIELD_LABEL[field]}
                  value={mapping[field] !== undefined ? String(mapping[field]) : "none"}
                  onChange={(value) =>
                    setMapping((current) => {
                      const next = { ...current };
                      if (!value || value === "none") delete next[field];
                      else next[field] = Number(value);
                      return next;
                    })
                  }
                  options={columnOptions}
                />
              ))}
            </div>
            {problems.length > 0 && <p className="mt-2 text-[13px] text-danger">{problems.join(" ")}</p>}
          </div>

          {problems.length === 0 && (
            <div>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <span className="label">Vorschau</span>
                <span className="label font-normal">
                  {valid.length} lesbar · {rows.length - valid.length} übersprungen · {existing.size} bereits vorhanden (abgewählt)
                </span>
              </div>
              <div className="max-h-72 overflow-auto rounded-[var(--radius)] border border-border">
                <table className="w-full text-[13px]">
                  <tbody>
                    {rows.slice(0, 300).map((row) => (
                      <tr key={row.line} className={`border-b border-separator last:border-0 ${row.error ? "text-muted" : ""}`}>
                        <td className="w-8 py-1.5 pl-2">
                          {!row.error && (
                            <Checkbox
                              aria-label={`Zeile ${row.line} importieren`}
                              isSelected={!excluded.has(row.line)}
                              onChange={(checked) =>
                                setExcluded((current) => {
                                  const next = new Set(current);
                                  if (checked) next.delete(row.line);
                                  else next.add(row.line);
                                  return next;
                                })
                              }
                            >
                              <Checkbox.Control>
                                <Checkbox.Indicator />
                              </Checkbox.Control>
                            </Checkbox>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5">{row.date ? formatDate(row.date) : "–"}</td>
                        <td className="max-w-[260px] truncate px-2 py-1.5">
                          {row.title}
                          {row.error && <span className="ml-2 text-danger">{row.error}</span>}
                          {!row.error && existing.has(row.key) && <span className="ml-2 text-warning">bereits vorhanden</span>}
                        </td>
                        <td className={`num whitespace-nowrap px-2 py-1.5 text-right ${row.type === "income" ? "text-success" : ""}`}>
                          {row.error ? "" : <Figures text={formatMoney(row.type === "income" ? row.amountCents : -row.amountCents, { signed: true })} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 300 && <p className="label mt-1 font-normal">Vorschau zeigt die ersten 300 von {rows.length} Zeilen.</p>}
            </div>
          )}
        </>
      )}
    </FormDialog>
  );
}
