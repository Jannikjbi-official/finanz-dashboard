"use client";

import { ArrowCounterClockwise, Trash } from "@phosphor-icons/react";
import { Button } from "@heroui/react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { Panel } from "@/components/ui/panel";
import { useAction } from "@/lib/client/use-action";
import type { TrashEntry } from "@/lib/domain/types";
import { formatDate } from "@/lib/format";
import { purgeFromTrash, restoreFromTrash } from "@/lib/server/actions/transactions";

const stamp = new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" });

/**
 * Geloeschte Buchungen und rueckgaengig gemachte Importe. Einzelne
 * Loeschungen bleiben 30 Tage, Importe bis zum endgueltigen Loeschen.
 */
export function TrashPanel({ entries }: { entries: TrashEntry[] }) {
  const { run, pending } = useAction();
  const [confirm, setConfirm] = useState<TrashEntry | "all" | null>(null);

  return (
    <Panel
      id="papierkorb"
      className="lg:self-start"
      title="Papierkorb"
      description="Gelöschte Buchungen bleiben 30 Tage, rückgängig gemachte Importe bis du sie endgültig löschst."
      bodyClassName=""
      action={
        entries.length > 0 ? (
          <Button size="sm" variant="ghost" onPress={() => setConfirm("all")}>
            Leeren
          </Button>
        ) : undefined
      }
    >
      {entries.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13.5px] text-muted sm:px-5">Der Papierkorb ist leer.</p>
      ) : (
        <ul className="rows">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="min-w-0 text-[13.5px]">
                <div className="truncate font-medium">{entry.label}</div>
                <div className="label font-normal">
                  {entry.fromImport ? "Import rückgängig gemacht" : "Gelöscht"} am {stamp.format(new Date(entry.deletedAt))}
                  {entry.expiresAt ? ` · wird am ${formatDate(entry.expiresAt.slice(0, 10))} endgültig gelöscht` : ""}
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button size="sm" variant="secondary" isPending={pending} onPress={() => run(() => restoreFromTrash(entry.id))}>
                  <ArrowCounterClockwise className="size-4" /> Wiederherstellen
                </Button>
                <Button size="sm" variant="ghost" aria-label={`${entry.label} endgültig löschen`} onPress={() => setConfirm(entry)}>
                  <Trash className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        isOpen={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm === "all" ? "Papierkorb leeren?" : "Endgültig löschen?"}
        confirmLabel={confirm === "all" ? "Alles endgültig löschen" : "Endgültig löschen"}
        pending={pending}
        onConfirm={() => run(() => purgeFromTrash(confirm === "all" ? undefined : confirm!.id))}
      >
        <p>
          {confirm === "all"
            ? `${entries.length} ${entries.length === 1 ? "Eintrag wird" : "Einträge werden"} endgültig gelöscht, auch die Sicherungen rückgängig gemachter Importe.`
            : confirm && `„${confirm.label}“ wird endgültig gelöscht.`}{" "}
          Das lässt sich nicht rückgängig machen.
        </p>
      </ConfirmDialog>
    </Panel>
  );
}
