"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { commitImport, previewImport, type CommitResult, type PreviewResult } from "@/lib/server/actions/import";
import { FIELD_LABEL, MAX_IMPORT_BYTES, type ImportField, type ImportMapping } from "@/lib/import";
import { formatDate } from "@/lib/format";
import { Button } from "@/ui/button";
import { Checkbox, Field, Select, Textarea } from "@/ui/field";
import { Money } from "@/ui/money";
import { Note, Pill } from "@/ui/layout";
import { FormError } from "@/ui/action-form";
import { cx } from "@/ui/cx";
import type { AccountOption } from "@/features/shared/types";

const FIELDS: ImportField[] = ["date", "title", "amount", "debit", "credit", "type", "category", "note"];

type Step = "source" | "check" | "done";

export function ImportWizard({ accounts }: { accounts: AccountOption[] }) {
  const [step, setStep] = useState<Step>("source");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<Extract<PreviewResult, { ok: true }> | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [accountId, setAccountId] = useState(accounts.find((a) => !a.archived)?.id ?? "none");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [createCategories, setCreateCategories] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<CommitResult, { ok: true }> | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  function runPreview(source: string, nextMapping: ImportMapping | null) {
    setError(null);
    startTransition(async () => {
      const response = await previewImport(source, nextMapping);
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setPreview(response);
      setMapping(response.mapping);
      setStep("check");
    });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setError("Die Datei ist größer als 2 MB.");
      return;
    }
    // Viele Banken exportieren in Windows-1252 statt UTF-8
    const buffer = await file.arrayBuffer();
    let content = new TextDecoder("utf-8").decode(buffer);
    if (content.includes("�")) content = new TextDecoder("windows-1252").decode(buffer);
    setFileName(file.name);
    setText(content);
    runPreview(content, null);
  }

  function changeMapping(field: ImportField, value: string) {
    const next = { ...mapping };
    if (value === "") delete next[field];
    else next[field] = Number(value);
    // Betrag mit Vorzeichen und Soll/Haben schliessen sich aus
    if (field === "amount" && value !== "") {
      delete next.debit;
      delete next.credit;
    }
    if ((field === "debit" || field === "credit") && value !== "") delete next.amount;
    setMapping(next);
    runPreview(text, next);
  }

  function commit() {
    setError(null);
    startTransition(async () => {
      const response = await commitImport({
        text,
        mapping,
        accountId: accountId === "none" ? null : accountId,
        skipDuplicates,
        createCategories,
      });
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setResult(response);
      setStep("done");
    });
  }

  function reset() {
    setStep("source");
    setText("");
    setFileName(null);
    setPreview(null);
    setMapping({});
    setResult(null);
    setError(null);
  }

  const steps: Array<{ key: Step; label: string }> = [
    { key: "source", label: "Datei" },
    { key: "check", label: "Prüfen & zuordnen" },
    { key: "done", label: "Übernommen" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex gap-6 border-b border-line pb-3 text-[13px]">
        {steps.map((entry, index) => (
          <li key={entry.key} className={cx("flex items-center gap-2", entry.key === step ? "font-medium text-ink" : "text-ink-3")}>
            <span className={cx("num flex size-5 items-center justify-center rounded-full border text-[11px]", entry.key === step ? "border-ink" : "border-line-strong")}>
              {index + 1}
            </span>
            {entry.label}
          </li>
        ))}
      </ol>

      {step === "source" ? (
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="flex flex-col gap-5">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                onFile(event.dataTransfer.files[0]);
              }}
              className="flex flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-line-strong bg-surface px-6 py-12 text-center hover:border-ink-3"
            >
              <UploadSimple size={26} className="text-ink-3" />
              <span className="text-[15px] font-medium">CSV-Datei wählen oder hierher ziehen</span>
              <span className="text-[13px] text-ink-3">Export aus dem Online-Banking, Excel oder einer anderen App · bis 2 MB</span>
            </button>
            <input ref={fileInput} type="file" accept=".csv,.txt,text/csv" className="sr-only" onChange={(event) => onFile(event.target.files?.[0])} />

            <details className="group">
              <summary className="cursor-pointer text-[13px] text-ink-2 hover:text-ink">Oder Text einfügen</summary>
              <div className="mt-3 flex flex-col gap-3">
                <Textarea value={text} onChange={(event) => setText(event.target.value)} rows={8} className="num text-[12px]" placeholder={"Datum;Bezeichnung;Betrag\n01.10.2026;Gehalt;2480,00\n03.10.2026;Miete;-890,00"} />
                <Button variant="secondary" onClick={() => runPreview(text, null)} pending={pending} disabled={!text.trim()} className="self-start">
                  Prüfen
                </Button>
              </div>
            </details>

            <FormError error={error} />
          </div>

          <aside className="flex flex-col gap-3 text-[13px] leading-relaxed text-ink-2">
            <p className="font-medium text-ink">So funktioniert der Import</p>
            <p>Spalten werden automatisch erkannt – auch Bankformate mit getrennten Soll- und Haben-Spalten oder Kontoinfos über der Kopfzeile.</p>
            <p>Vor der Übernahme siehst du jede Zeile: fehlerhafte werden markiert, bereits vorhandene als Dublette erkannt.</p>
            <p>Die Datei wird nur gelesen, nicht gespeichert.</p>
          </aside>
        </div>
      ) : null}

      {step === "check" && preview ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[14px]">
            <span className="font-medium">{fileName ?? "Eingefügter Text"}</span>
            <span className="text-ink-2">{preview.stats.total} Zeilen</span>
            <span className="text-pos">{preview.stats.valid - (skipDuplicates ? preview.stats.duplicates : 0)} werden übernommen</span>
            {preview.stats.duplicates > 0 ? <span className="text-warn">{preview.stats.duplicates} Dubletten</span> : null}
            {preview.stats.invalid > 0 ? <span className="text-neg">{preview.stats.invalid} fehlerhaft</span> : null}
          </div>

          <section className="card">
            <h2 className="mb-3 text-[14px] font-semibold">Spalten zuordnen</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {FIELDS.map((field) => (
                <Field key={field} label={FIELD_LABEL[field]} htmlFor={`map-${field}`}>
                  <Select
                    id={`map-${field}`}
                    value={mapping[field] !== undefined ? String(mapping[field]) : ""}
                    onChange={(event) => changeMapping(field, event.target.value)}
                    disabled={pending}
                  >
                    <option value="">–</option>
                    {preview.header.map((name, index) => (
                      <option key={index} value={index}>
                        {name || `Spalte ${index + 1}`}
                      </option>
                    ))}
                  </Select>
                </Field>
              ))}
            </div>
            {preview.problems.map((problem) => (
              <p key={problem} className="mt-3 text-[13px] text-neg">
                {problem}
              </p>
            ))}
          </section>

          {preview.rows.length > 0 ? (
            <section className="overflow-x-auto">
              <table className={cx("w-full min-w-[640px] text-[13px] transition-opacity", pending && "opacity-50")}>
                <thead>
                  <tr className="border-b border-line text-left text-[12px] text-ink-3">
                    <th className="py-2 pr-3 font-medium">Zeile</th>
                    <th className="py-2 pr-3 font-medium">Datum</th>
                    <th className="py-2 pr-3 font-medium">Bezeichnung</th>
                    <th className="py-2 pr-3 font-medium">Kategorie</th>
                    <th className="py-2 pr-3 text-right font-medium">Betrag</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.line} className={cx("border-b border-line", (row.error || (row.duplicate && skipDuplicates)) && "text-ink-3")}>
                      <td className="num py-2 pr-3">{row.line}</td>
                      <td className="num py-2 pr-3">{row.date ? formatDate(row.date) : "–"}</td>
                      <td className="max-w-[18rem] truncate py-2 pr-3">{row.title}</td>
                      <td className="py-2 pr-3">{row.category ?? ""}</td>
                      <td className="py-2 pr-3 text-right">
                        {row.error ? "–" : <Money cents={row.type === "income" ? row.amountCents : -row.amountCents} tone="flow" />}
                      </td>
                      <td className="py-2">
                        {row.error ? <Pill tone="neg">{row.error}</Pill> : row.duplicate ? <Pill tone="warn">Dublette</Pill> : <Pill tone="pos">neu</Pill>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.stats.total > preview.rows.length ? (
                <p className="mt-2 text-[12px] text-ink-3">Vorschau zeigt die ersten {preview.rows.length} Zeilen; übernommen werden alle.</p>
              ) : null}
            </section>
          ) : null}

          <section className="grid gap-5 border-t border-line pt-5 sm:grid-cols-[18rem_1fr]">
            <Field label="Auf welches Konto?" htmlFor="import-account">
              <Select id="import-account" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                <option value="none">Kein Konto</option>
                {accounts
                  .filter((a) => !a.archived)
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <div className="flex flex-col gap-3 sm:pt-6">
              <Checkbox checked={skipDuplicates} onChange={(event) => setSkipDuplicates(event.target.checked)} label="Dubletten überspringen" />
              {preview.unknownCategories.length > 0 ? (
                <Checkbox
                  checked={createCategories}
                  onChange={(event) => setCreateCategories(event.target.checked)}
                  label={`Fehlende Kategorien anlegen (${preview.unknownCategories.slice(0, 4).join(", ")}${preview.unknownCategories.length > 4 ? " …" : ""})`}
                />
              ) : null}
            </div>
          </section>

          <FormError error={error} />

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={commit} pending={pending} disabled={preview.problems.length > 0 || preview.stats.valid === 0}>
              Buchungen übernehmen
            </Button>
            <Button variant="ghost" onClick={reset}>
              Andere Datei
            </Button>
          </div>
        </div>
      ) : null}

      {step === "done" && result ? (
        <div className="flex flex-col items-start gap-3">
          <p className="font-serif text-[26px] leading-tight">{result.imported} Buchungen übernommen.</p>
          <p className="text-[14px] text-ink-2">
            {result.skipped > 0 ? `${result.skipped} Zeilen übersprungen (Dubletten oder fehlerhaft). ` : ""}
            {result.createdCategories.length > 0 ? `Neue Kategorien: ${result.createdCategories.join(", ")}.` : ""}
          </p>
          <div className="mt-2 flex gap-2">
            <Link href="/app/geld/buchungen?monat=alle" className="inline-flex h-10 items-center rounded-sm bg-accent px-3.5 text-[14px] font-medium text-accent-ink hover:bg-accent-hover">
              Buchungen ansehen
            </Link>
            <Button variant="ghost" onClick={reset}>
              Weitere Datei
            </Button>
          </div>
        </div>
      ) : null}

      {step !== "done" ? (
        <Note>
          Tipp: Wiederkehrende Zahlungen aus dem Import lassen sich unter Planung → Fixkosten als Abo anlegen; danach erkennt die
          Prognose sie.
        </Note>
      ) : null}
    </div>
  );
}
