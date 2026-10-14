"use client";

import { Checkbox, toast } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuickAdd } from "@/components/shell/quick-add";
import { Figures } from "@/components/ui/money";
import type { Account } from "@/lib/domain/types";
import { formatDate, formatMoney } from "@/lib/format";
import {
  defaultSelection,
  FIELD_LABEL,
  guessMapping,
  mappingProblems,
  mapRows,
  matchAccount,
  MAX_IMPORT_BYTES,
  missingCategories,
  parseTable,
  type ImportField,
  type ImportMapping,
  type ImportRow,
  type Table,
} from "@/lib/import";
import { findExistingImportKeys, importTransactions } from "@/lib/server/actions/import";
import { DateInput, MoneyInput, SelectInput } from "./fields";
import { FormDialog } from "./form-dialog";

const FIELDS: ImportField[] = ["date", "title", "amount", "debit", "credit", "type", "status", "account", "category", "note"];

const STATUS_LABEL: Record<ImportRow["status"], string | null> = { booked: null, pending: "Vorgemerkt", planned: "Geplant" };

/**
 * CSV-Import: Datei lesen, Spalten zuordnen (automatisch erkannt, aenderbar),
 * Vorschau mit Dublettenpruefung, dann in ein Konto uebernehmen.
 *
 * - Gebucht aendert den Kontostand, Vorgemerkt erscheint als "Vorgemerkt",
 *   Geplant ist abgewaehlt (gehoert auf die Wunschliste) und wird sonst als
 *   geplante Zahlung angelegt.
 * - Umbuchungen werden Transfers und zaehlen nie als Einnahme oder Ausgabe.
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
  const { lookups } = useQuickAdd();
  const active = accounts.filter((account) => !account.archived);
  const [fileName, setFileName] = useState<string | null>(null);
  const [table, setTable] = useState<Table | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [accountId, setAccountId] = useState<string | null>(active.find((a) => a.kind === "giro")?.id ?? active[0]?.id ?? null);
  const [duplicates, setDuplicates] = useState<Set<number>>(new Set());
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [counterAccountId, setCounterAccountId] = useState<string>("none");
  const [createCategories, setCreateCategories] = useState(true);
  const [balance, setBalance] = useState("");
  const [balanceDate, setBalanceDate] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => (table ? mapRows(table, mapping, lookups.today) : []), [table, mapping, lookups.today]);
  const problems = table ? mappingProblems(mapping) : [];
  const valid = rows.filter((row) => !row.error);

  // Vorauswahl: Geplantes und schon Vorhandenes abwaehlen
  useEffect(() => {
    const initial = defaultSelection(rows, []);
    setDuplicates(initial.duplicates);
    setExcluded(initial.excluded);
    const keys = rows.filter((row) => !row.error).map((row) => row.key);
    if (keys.length === 0) return;
    let cancelled = false;
    findExistingImportKeys(keys).then((found) => {
      if (cancelled) return;
      const next = defaultSelection(rows, found);
      setDuplicates(next.duplicates);
      setExcluded(next.excluded);
    });
    return () => {
      cancelled = true;
    };
  }, [rows]);

  // Gegenkonto fuer Umbuchungen vorschlagen, wenn ein Kontoname in den Zeilen vorkommt
  useEffect(() => {
    const transfers = rows.filter((row) => row.transfer);
    if (transfers.length === 0) return;
    const text = transfers.map((row) => `${row.title} ${row.category ?? ""}`.toLowerCase()).join(" ");
    const guess = active.find((account) => account.id !== accountId && account.name.length >= 3 && text.includes(account.name.toLowerCase()));
    setCounterAccountId(guess?.id ?? "none");
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
  }

  const selected = valid.filter((row) => !excluded.has(row.line));
  const rowAccount = (row: ImportRow) => (mapping.account !== undefined ? matchAccount(row.account, active) : null) ?? accountId;
  const accountName = new Map(active.map((account) => [account.id, account.name]));
  const missing = missingCategories(selected, lookups.categories);
  const counts = {
    booked: selected.filter((row) => row.status === "booked" && !row.transfer).length,
    pending: selected.filter((row) => row.status === "pending").length,
    planned: valid.filter((row) => row.status === "planned").length,
    plannedSelected: selected.filter((row) => row.status === "planned").length,
    transfers: selected.filter((row) => row.transfer && row.status === "booked").length,
  };

  // Kontostand gilt fuer den letzten gebuchten Tag der Datei
  const lastBooked = selected
    .filter((row) => row.status === "booked" && row.date && row.date <= lookups.today)
    .map((row) => row.date!)
    .sort()
    .at(-1);
  const anchorDate = balanceDate ?? lastBooked ?? lookups.today;
  const target = active.find((account) => account.id === accountId);

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
        fileName,
        counterAccountId: counterAccountId === "none" ? null : counterAccountId,
        createCategories,
        balance,
        balanceDate: balance.trim() ? anchorDate : null,
        rows: selected.map((row) => {
          const target = rowAccount(row);
          return {
            date: row.date!,
            title: row.title,
            amountCents: row.amountCents,
            type: row.type,
            status: row.status,
            transfer: row.transfer,
            accountId: target !== accountId ? target : null,
            category: row.category,
            note: row.note,
          };
        }),
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
      description="Umsätze aus dem Export deiner Bank übernehmen. Es wird nichts geschätzt: nicht lesbare Zeilen werden übersprungen. Jeder Import lässt sich danach vollständig rückgängig machen."
      size="lg"
      submitLabel={selected.length > 0 ? `${selected.length} Zeilen importieren` : "Importieren"}
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
            description={mapping.account !== undefined ? "Zeilen, deren Konto-Spalte zu einem anderen Konto passt, landen dort." : undefined}
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
                  {counts.booked} gebucht · {counts.pending} vorgemerkt · {counts.transfers} Umbuchungen
                  {counts.planned ? ` · ${counts.planned} geplant` : ""} · {duplicates.size} schon vorhanden · {rows.length - valid.length} nicht lesbar
                </span>
              </div>
              <div className="max-h-72 overflow-auto rounded-[var(--radius)] border border-border">
                <table className="w-full text-[13px]">
                  <tbody>
                    {rows.slice(0, 300).map((row) => {
                      const target = rowAccount(row);
                      const tags = [
                        STATUS_LABEL[row.status],
                        row.transfer ? "Umbuchung" : null,
                        duplicates.has(row.line) ? "schon vorhanden" : null,
                        mapping.account !== undefined && target !== accountId && target ? `→ ${accountName.get(target)}` : null,
                      ].filter(Boolean);
                      return (
                        <tr key={row.line} className={`border-b border-separator last:border-0 ${row.error || excluded.has(row.line) ? "text-muted" : ""}`}>
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
                          <td className="max-w-[260px] px-2 py-1.5">
                            <div className="truncate">
                              {row.title}
                              {row.error && <span className="ml-2 text-danger">{row.error}</span>}
                            </div>
                            {tags.length > 0 && <div className="label truncate font-normal text-warning">{tags.join(" · ")}</div>}
                          </td>
                          <td className={`num whitespace-nowrap px-2 py-1.5 text-right ${row.type === "income" && !row.transfer ? "text-success" : ""}`}>
                            {row.error ? "" : <Figures text={formatMoney(row.type === "income" ? row.amountCents : -row.amountCents, { signed: true })} />}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {rows.length > 300 && <p className="label mt-1 font-normal">Vorschau zeigt die ersten 300 von {rows.length} Zeilen.</p>}
            </div>
          )}

          {problems.length === 0 && (
            <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-separator px-3 py-3">
              <div className="text-[13px] font-medium">Kontostand laut Bank (empfohlen)</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <MoneyInput label={`Stand ${target ? `von ${target.name}` : ""}`} value={balance} onChange={setBalance} isRequired={false} allowNegative />
                <DateInput label="am" value={anchorDate} onChange={setBalanceDate} />
              </div>
              <p className="label font-normal">
                Gebuchter Stand am Ende dieses Tages, ohne vorgemerkte Umsätze. Dann stimmt der Kontostand im Portal sofort – die Datei selbst enthält
                keinen Anfangssaldo.
                {target?.balanceAnchor ? ` Bisher: ${formatMoney(target.balanceAnchor.amountCents)} am ${formatDate(target.balanceAnchor.date)}.` : ""}
              </p>
            </div>
          )}

          {problems.length === 0 && (counts.pending > 0 || counts.planned > 0 || counts.transfers > 0 || missing.length > 0) && (
            <div className="flex flex-col gap-3 rounded-[var(--radius)] bg-surface-secondary px-3 py-3 text-[13px]">
              {counts.pending > 0 && (
                <p className="text-muted">
                  <span className="font-medium text-foreground">Vorgemerkt:</span> zählt erst nach der Buchung zum Kontostand, wird aber in „Aktuell
                  verfügbar“ schon abgezogen. Beim nächsten Import werden alte Vormerkungen durch den neuen Stand ersetzt.
                </p>
              )}
              {counts.planned > 0 && (
                <p className="text-muted">
                  <span className="font-medium text-foreground">Geplant ({counts.planned}):</span> nicht ausgewählt – das gehört auf die Wunschliste (Wünsche →
                  CSV importieren).{" "}
                  {counts.plannedSelected > 0 ? `${counts.plannedSelected} ausgewählte werden als geplante Zahlungen angelegt.` : "Wählst du sie hier aus, werden sie geplante Zahlungen."}
                </p>
              )}
              {counts.transfers > 0 && (
                <SelectInput
                  label={`Gegenkonto für ${counts.transfers} Umbuchungen`}
                  value={counterAccountId}
                  onChange={(value) => setCounterAccountId(value ?? "none")}
                  options={[
                    { id: "none", label: "Kein Konto im Portal – nur hier ab- bzw. zubuchen" },
                    ...active.filter((a) => a.id !== accountId).map((a) => ({ id: a.id, label: a.name })),
                  ]}
                  description="Umbuchungen zählen nie als Einnahme oder Ausgabe. Mit Gegenkonto ändert sich dessen Kontostand mit."
                />
              )}
              {missing.length > 0 && (
                <Checkbox isSelected={createCategories} onChange={setCreateCategories}>
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    {missing.length} fehlende Kategorien anlegen: {missing.slice(0, 6).join(", ")}
                    {missing.length > 6 ? " …" : ""}
                  </Checkbox.Content>
                </Checkbox>
              )}
            </div>
          )}
        </>
      )}
    </FormDialog>
  );
}
