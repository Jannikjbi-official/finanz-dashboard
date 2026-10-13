"use client";

import { Checkbox, toast } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Figures } from "@/components/ui/money";
import type { Account } from "@/lib/domain/types";
import { formatDate, formatMoney } from "@/lib/format";
import { MAX_IMPORT_BYTES, parseTable, type Table } from "@/lib/import";
import { findExistingWishKeys, importWishes } from "@/lib/server/actions/wishes";
import {
  guessWishMapping,
  mapWishRows,
  WISH_FIELD_LABEL,
  wishMappingProblems,
  type WishField,
  type WishMapping,
} from "@/lib/wish-import";
import { SelectInput } from "./fields";
import { FormDialog } from "./form-dialog";

const FIELDS: WishField[] = ["title", "amount", "date", "group", "priority", "category", "link", "note", "status", "type"];

/**
 * Wunschliste aus einer CSV-Datei. Eigener Import, getrennt vom Kontoimport:
 * hier entstehen nur Wuensche, keine Buchungen. Bei gemischten Dateien sind
 * nur die geplanten Zeilen vorausgewaehlt.
 */
export function WishImportDialog({
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
  const [mapping, setMapping] = useState<WishMapping>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [planDated, setPlanDated] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(active.find((a) => a.kind === "giro")?.id ?? active[0]?.id ?? null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => (table ? mapWishRows(table, mapping) : []), [table, mapping]);
  const problems = table ? wishMappingProblems(mapping) : [];

  // Vorauswahl bei neuer Zuordnung: geplante Zeilen, die es noch nicht gibt
  useEffect(() => {
    const keys = rows.filter((row) => !row.error).map((row) => row.key);
    setSelected(new Set(rows.filter((row) => row.suggested).map((row) => row.line)));
    if (keys.length === 0) return;
    let cancelled = false;
    findExistingWishKeys(keys).then((found) => {
      if (cancelled) return;
      const set = new Set(found);
      setExisting(set);
      setSelected(new Set(rows.filter((row) => row.suggested && !set.has(row.key)).map((row) => row.line)));
    });
    return () => {
      cancelled = true;
    };
  }, [rows]);

  async function readFile(file: File) {
    setError(null);
    if (file.size > MAX_IMPORT_BYTES) {
      setError("Die Datei ist größer als 2 MB.");
      return;
    }
    const buffer = await file.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(buffer);
    if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buffer);
    const parsed = parseTable(text);
    if (parsed.header.length === 0 || parsed.rows.length === 0) {
      setError("In der Datei wurden keine Zeilen gefunden.");
      return;
    }
    setFileName(file.name);
    setTable(parsed);
    setMapping(guessWishMapping(parsed.header));
    setExisting(new Set());
  }

  const chosen = rows.filter((row) => !row.error && selected.has(row.line));
  const chosenTotal = chosen.reduce((sum, row) => sum + row.amountCents, 0);
  const datedCount = chosen.filter((row) => row.targetDate).length;

  async function submit() {
    if (!table) return false;
    if (problems.length > 0) {
      setError(problems.join(" "));
      return false;
    }
    if (chosen.length === 0) {
      setError("Keine Zeilen ausgewählt.");
      return false;
    }
    setPending(true);
    try {
      const result = await importWishes({
        fileName,
        planDated,
        accountId: planDated ? accountId : null,
        rows: chosen.map((row) => ({
          title: row.title,
          amountCents: row.amountCents,
          targetDate: row.targetDate,
          priority: row.priority,
          group: row.group,
          link: row.link,
          note: row.note,
          category: row.category,
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
      title="Wünsche importieren"
      description="Eine Wunsch- oder Einkaufsliste als CSV übernehmen. Es entstehen nur Wünsche, keine Buchungen – echte Kontoumsätze gehören in den Kontoimport unter Einstellungen."
      size="lg"
      submitLabel={chosen.length > 0 ? `${chosen.length} Wünsche importieren` : "Importieren"}
      pending={pending}
      onSubmit={submit}
    >
      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-[var(--radius)] border border-dashed border-border px-4 py-6 text-center hover:bg-surface-secondary">
        <span className="font-medium">{fileName ?? "CSV-Datei auswählen"}</span>
        <span className="label font-normal">Spalten wie Bezeichnung, Preis, Datum, Gruppe, Link, Priorität werden erkannt. Höchstens 2 MB.</span>
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
          <div>
            <div className="label mb-2">Spaltenzuordnung</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FIELDS.map((field) => (
                <SelectInput
                  key={field}
                  label={WISH_FIELD_LABEL[field]}
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
                  {chosen.length} ausgewählt · <Figures text={formatMoney(chosenTotal)} />
                  {existing.size > 0 ? ` · ${existing.size} schon vorhanden` : ""}
                </span>
              </div>
              <div className="max-h-72 overflow-auto rounded-[var(--radius)] border border-border">
                <table className="w-full text-[13px]">
                  <tbody>
                    {rows.slice(0, 300).map((row) => {
                      const hint = row.error ?? (existing.has(row.key) ? "schon auf der Wunschliste" : row.reason);
                      return (
                        <tr key={row.line} className={`border-b border-separator last:border-0 ${row.error || !selected.has(row.line) ? "text-muted" : ""}`}>
                          <td className="w-8 py-1.5 pl-2">
                            {!row.error && (
                              <Checkbox
                                aria-label={`Zeile ${row.line} importieren`}
                                isSelected={selected.has(row.line)}
                                onChange={(checked) =>
                                  setSelected((current) => {
                                    const next = new Set(current);
                                    if (checked) next.add(row.line);
                                    else next.delete(row.line);
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
                          <td className="whitespace-nowrap px-2 py-1.5">{row.targetDate ? formatDate(row.targetDate) : "offen"}</td>
                          <td className="max-w-[300px] px-2 py-1.5">
                            <div className="truncate">{row.title || "–"}</div>
                            {(row.group || hint) && (
                              <div className="label truncate font-normal">
                                {row.group}
                                {row.group && hint ? " · " : ""}
                                {hint && <span className={row.error ? "text-danger" : "text-warning"}>{hint}</span>}
                              </div>
                            )}
                          </td>
                          <td className="num whitespace-nowrap px-2 py-1.5 text-right">{row.error ? "" : <Figures text={formatMoney(row.amountCents)} />}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {rows.length > 300 && <p className="label mt-1 font-normal">Vorschau zeigt die ersten 300 von {rows.length} Zeilen.</p>}
            </div>
          )}

          {problems.length === 0 && datedCount > 0 && (
            <div className="flex flex-col gap-3 rounded-[var(--radius)] bg-surface-secondary px-3 py-3">
              <Checkbox isSelected={planDated} onChange={setPlanDated}>
                <Checkbox.Content>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  {datedCount} Wünsche mit Termin direkt einplanen
                </Checkbox.Content>
              </Checkbox>
              <p className="label -mt-1 font-normal">
                Dann zählen sie als geplante Zahlungen in „Aktuell verfügbar“. Ohne Haken bleiben alle erst einmal Wünsche – einplanen kannst du später einzeln.
              </p>
              {planDated && (
                <SelectInput label="Bezahlt von" value={accountId} onChange={setAccountId} options={active.map((a) => ({ id: a.id, label: a.name }))} isRequired />
              )}
            </div>
          )}
        </>
      )}
    </FormDialog>
  );
}
