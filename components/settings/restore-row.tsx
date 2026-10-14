"use client";

import { ArrowCounterClockwise, UploadSimple } from "@phosphor-icons/react";
import { Button } from "@heroui/react";
import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { useAction } from "@/lib/client/use-action";
import type { SnapshotInfo } from "@/lib/domain/types";
import { restoreFromBackup, restorePreviousState } from "@/lib/server/actions/backup";

const stamp = new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" });


type Preview = { text: string; fileName: string; exportedAt: string | null; counts: Record<string, number> };

const MAX_BYTES = 3_900_000;

function describe(counts: Record<string, number>) {
  return [
    `${counts.accounts ?? 0} Konten`,
    `${counts.transactions ?? 0} Buchungen`,
    `${counts.recurring ?? 0} regelmäßige Zahlungen`,
    `${counts.categories ?? 0} Kategorien`,
    counts.wishes ? `${counts.wishes} Wünsche` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * JSON-Sicherung einspielen (ersetzt alle eigenen Daten) und den Stand von
 * vor der letzten Wiederherstellung zurueckholen.
 */
export function RestoreRow({ snapshots }: { snapshots: SnapshotInfo[] }) {
  const { run, pending } = useAction();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [undo, setUndo] = useState<SnapshotInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function read(file: File) {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("Die Datei ist zu groß (höchstens 4 MB).");
      return;
    }
    const text = await file.text();
    try {
      const data = JSON.parse(text) as Record<string, unknown>;
      if (!Array.isArray(data.accounts) || !Array.isArray(data.transactions)) throw new Error();
      const counts = Object.fromEntries(Object.entries(data).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, (value as unknown[]).length]));
      setPreview({ text, fileName: file.name, exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : null, counts });
    } catch {
      setError("Das ist keine JSON-Sicherung aus dieser App.");
    }
  }

  const latest = snapshots[0] ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="font-medium">Sicherung wiederherstellen</div>
          <div className="label font-normal">JSON-Sicherung einspielen. Ersetzt alle aktuellen Daten – der jetzige Stand wird vorher gesichert.</div>
        </div>
        <div className="shrink-0">
          <Button size="sm" variant="secondary" onPress={() => input.current?.click()}>
            <UploadSimple className="size-4" /> JSON
          </Button>
          <input
            ref={input}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void read(file);
            }}
          />
        </div>
      </div>
      {error && <p className="rounded-[var(--radius)] bg-danger-soft px-3 py-2 text-[13px] text-danger-soft-foreground">{error}</p>}
      {latest && (
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-separator px-3 py-2.5">
          <div className="min-w-0 text-[13px]">
            <div>Stand vom {stamp.format(new Date(latest.createdAt))}</div>
            <div className="label font-normal">
              {latest.reason}: {describe(latest.counts)}
            </div>
          </div>
          <Button size="sm" variant="ghost" className="shrink-0" onPress={() => setUndo(latest)}>
            <ArrowCounterClockwise className="size-4" /> Zurückholen
          </Button>
        </div>
      )}

      <ConfirmDialog
        isOpen={preview !== null}
        onOpenChange={(open) => !open && setPreview(null)}
        title="Sicherung einspielen?"
        confirmLabel="Daten ersetzen"
        pending={pending}
        onConfirm={() => run(() => restoreFromBackup(preview!.text))}
      >
        {preview && (
          <>
            <p>
              „{preview.fileName}“{preview.exportedAt ? ` vom ${stamp.format(new Date(preview.exportedAt))}` : ""} enthält {describe(preview.counts)}.
            </p>
            <p>
              Alle aktuellen Konten, Buchungen, Kategorien, regelmäßigen Zahlungen und Wünsche werden durch die Sicherung ersetzt. Der jetzige
              Stand wird vorher gespeichert und lässt sich hier mit „Zurückholen“ wiederherstellen.
            </p>
          </>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={undo !== null}
        onOpenChange={(open) => !open && setUndo(null)}
        title="Früheren Stand zurückholen?"
        confirmLabel="Zurückholen"
        tone="default"
        pending={pending}
        onConfirm={() => run(() => restorePreviousState(undo!.id))}
      >
        {undo && (
          <p>
            Der Stand vom {stamp.format(new Date(undo.createdAt))} ({describe(undo.counts)}) ersetzt die aktuellen Daten. Der jetzige Stand wird
            ebenfalls vorher gesichert.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
