"use client";

import { Button } from "@heroui/react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { useAction } from "@/lib/client/use-action";
import type { ImportInfo } from "@/lib/domain/types";
import { formatDate } from "@/lib/format";
import { undoImport } from "@/lib/server/actions/import";

const stamp = new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" });

/** Letzte Importe mit Zeitpunkt, Datei und Zeitraum – jeweils rueckgaengig zu machen. */
export function ImportList({ imports, noun }: { imports: ImportInfo[]; noun: { one: string; many: string } }) {
  const { run, pending } = useAction();
  const [target, setTarget] = useState<ImportInfo | null>(null);

  if (imports.length === 0) return null;

  return (
    <div>
      <div className="label mb-1">Letzte Importe</div>
      <ul className="rows">
        {imports.map((entry) => (
          <li key={entry.id} className={`flex items-center justify-between gap-3 py-2 ${entry.undoneAt ? "text-muted" : ""}`}>
            <span className="min-w-0">
              <span className="block truncate">{entry.fileName ?? "CSV-Datei"}</span>
              <span className="label block font-normal">
                {stamp.format(new Date(entry.createdAt))} · {entry.rowCount} {entry.rowCount === 1 ? noun.one : noun.many}
                {entry.dateFrom && entry.dateTo ? ` · ${formatDate(entry.dateFrom)} – ${formatDate(entry.dateTo)}` : ""}
                {entry.undoneAt ? ` · rückgängig gemacht am ${stamp.format(new Date(entry.undoneAt))}` : ""}
              </span>
            </span>
            {!entry.undoneAt && (
              <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 font-normal text-muted" onPress={() => setTarget(entry)}>
                Rückgängig
              </Button>
            )}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        isOpen={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
        title="Import rückgängig machen?"
        confirmLabel="Import löschen"
        pending={pending}
        onConfirm={() => run(() => undoImport(target!.id))}
      >
        <p>
          Alle {target?.rowCount} {noun.many} aus „{target?.fileName ?? "CSV-Datei"}“ werden gelöscht – auch wenn du sie danach bearbeitet hast. Alles andere
          bleibt unverändert.
        </p>
      </ConfirmDialog>
    </div>
  );
}
