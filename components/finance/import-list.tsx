"use client";

import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { Button } from "@heroui/react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { useAction } from "@/lib/client/use-action";
import type { ImportInfo } from "@/lib/domain/types";
import { formatDate } from "@/lib/format";
import { undoImport } from "@/lib/server/actions/import";

const stamp = new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" });

type Noun = { one: string; many: string };

function importName(entry: ImportInfo) {
  return entry.fileName ?? (entry.legacy ? "Import ohne Dateinamen" : "CSV-Datei");
}

function importDetails(entry: ImportInfo, noun: Noun) {
  const range = entry.dateFrom && entry.dateTo ? ` · ${formatDate(entry.dateFrom)} – ${formatDate(entry.dateTo)}` : "";
  return `${stamp.format(new Date(entry.createdAt))} · ${entry.rowCount} ${entry.rowCount === 1 ? noun.one : noun.many}${range}`;
}

/** Bestaetigung und Ausfuehrung "Import rueckgaengig machen". */
function useUndo(noun: Noun) {
  const { run, pending } = useAction();
  const [target, setTarget] = useState<ImportInfo | null>(null);

  const dialog = (
    <ConfirmDialog
      isOpen={target !== null}
      onOpenChange={(open) => !open && setTarget(null)}
      title="Import rückgängig machen?"
      confirmLabel={`${target?.rowCount ?? ""} ${noun.many} löschen`}
      pending={pending}
      onConfirm={() => run(() => undoImport(target!.id))}
    >
      {target && (
        <p>
          Alle {target.rowCount} {noun.many} {target.fileName ? `aus „${target.fileName}“` : "dieses Imports"} vom {stamp.format(new Date(target.createdAt))}
          {target.dateFrom && target.dateTo ? ` (Zeitraum ${formatDate(target.dateFrom)} – ${formatDate(target.dateTo)})` : ""} werden gelöscht – auch wenn du
          sie danach bearbeitet hast. Selbst angelegte Buchungen, Konten, regelmäßige Zahlungen und Abos bleiben unverändert. Eine
          vollständige Kopie der gelöschten Einträge wird vorher gesichert.
        </p>
      )}
    </ConfirmDialog>
  );
  return { ask: setTarget, dialog };
}

/** Letzte Importe; der neueste offene steht mit eigenem Knopf ganz oben. */
export function ImportList({ imports, noun }: { imports: ImportInfo[]; noun: Noun }) {
  const { ask, dialog } = useUndo(noun);
  if (imports.length === 0) return null;

  const latest = imports.find((entry) => !entry.undoneAt) ?? null;
  const others = imports.filter((entry) => entry !== latest);

  return (
    <div className="flex flex-col gap-3">
      {latest && (
        <div className="flex flex-col items-start gap-2.5 rounded-[var(--radius)] border border-separator px-3 py-3">
          <div className="min-w-0">
            <div className="label">Letzter Import</div>
            <div className="font-medium">{importName(latest)}</div>
            <div className="label font-normal">{importDetails(latest, noun)}</div>
          </div>
          <Button size="sm" variant="danger-soft" onPress={() => ask(latest)}>
            <ArrowCounterClockwise className="size-4" /> Letzten Import rückgängig machen
          </Button>
        </div>
      )}

      {others.length > 0 && (
        <div>
          <div className="label mb-1">Frühere Importe</div>
          <ul className="rows">
            {others.map((entry) => (
              <li key={entry.id} className={`flex items-center justify-between gap-3 py-2 ${entry.undoneAt ? "text-muted" : ""}`}>
                <span className="min-w-0">
                  <span className="block truncate">{importName(entry)}</span>
                  <span className="label block font-normal">
                    {importDetails(entry, noun)}
                    {entry.undoneAt ? ` · rückgängig gemacht am ${stamp.format(new Date(entry.undoneAt))}` : ""}
                  </span>
                </span>
                {!entry.undoneAt && (
                  <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 font-normal text-muted" onPress={() => ask(entry)}>
                    Rückgängig
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {dialog}
    </div>
  );
}

/** Hinweis auf der Uebersicht nach einem frischen Import, mit Rueckgaengig-Knopf. */
export function LastImportNotice({ entry }: { entry: ImportInfo }) {
  const noun = { one: "Buchung", many: "Buchungen" };
  const { ask, dialog } = useUndo(noun);
  return (
    <div className="panel flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0 text-[13px]">
        <span className="font-medium">Letzter Import: </span>
        <span className="text-muted">
          {importName(entry)} · {importDetails(entry, noun)}
        </span>
      </div>
      <Button size="sm" variant="danger-soft" className="shrink-0" onPress={() => ask(entry)}>
        <ArrowCounterClockwise className="size-4" /> Rückgängig machen
      </Button>
      {dialog}
    </div>
  );
}
