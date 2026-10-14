"use client";

import { FilePdf, Paperclip, X } from "@phosphor-icons/react";
import { Button, Spinner } from "@heroui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { shrinkImage } from "@/lib/client/image";
import { useAction } from "@/lib/client/use-action";
import { getReceipts, removeReceipt, uploadReceipt } from "@/lib/server/actions/receipts";

type Info = Awaited<ReturnType<typeof getReceipts>>[number];

const MAX_BYTES = 2 * 1024 * 1024;

/** Belege einer Buchung: anzeigen, anhaengen (Foto/PDF), entfernen. */
export function ReceiptsField({ transactionId }: { transactionId: string }) {
  const { run, pending } = useAction();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Info[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => setItems(await getReceipts(transactionId)), [transactionId]);
  useEffect(() => {
    void load();
  }, [load]);

  async function upload(original: File) {
    setError(null);
    setBusy(true);
    try {
      const file = await shrinkImage(original);
      if (file.size > MAX_BYTES) {
        setError("Die Datei ist zu groß (höchstens 2 MB).");
        return;
      }
      const form = new FormData();
      form.set("transactionId", transactionId);
      form.set("file", file);
      if (await run(() => uploadReceipt(form))) await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="label">Belege</span>
        <Button size="sm" variant="ghost" isPending={busy} isDisabled={(items?.length ?? 0) >= 5} onPress={() => input.current?.click()}>
          {busy ? <Spinner size="sm" color="current" /> : <Paperclip className="size-4" />} Beleg anhängen
        </Button>
        <input
          ref={input}
          type="file"
          accept="image/*,application/pdf"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
      </div>
      {error && <p className="text-[13px] text-danger">{error}</p>}
      {items && items.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {items.map((item) => (
            <li key={item.id} className="group relative">
              <a
                href={`/api/belege/${item.id}`}
                target="_blank"
                rel="noopener"
                className="flex size-16 items-center justify-center overflow-hidden rounded-[var(--radius)] border border-separator bg-surface-secondary"
                title={item.fileName}
              >
                {item.contentType === "application/pdf" ? (
                  <FilePdf className="size-7 text-muted" aria-label={item.fileName} />
                ) : (
                  <img src={`/api/belege/${item.id}`} alt={item.fileName} className="size-full object-cover" />
                )}
              </a>
              <button
                type="button"
                aria-label={`${item.fileName} entfernen`}
                disabled={pending}
                onClick={async () => {
                  if (await run(() => removeReceipt(item.id))) await load();
                }}
                className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border border-separator bg-background text-muted hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
