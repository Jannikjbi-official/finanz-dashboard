"use client";

import { toast } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { restoreFromTrash } from "@/lib/server/actions/transactions";

type Result = { ok: true; message?: string; undo?: string } | { ok: false; error: string };

/**
 * Fuehrt eine Server Action aus, zeigt das Ergebnis als Toast und laedt die
 * Seite neu. Liefert true bei Erfolg, damit Dialoge sich schliessen koennen.
 */
export function useAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async (action: () => Promise<Result>, options: { silent?: boolean } = {}) => {
      setPending(true);
      try {
        const result = await action();
        if (result.ok) {
          const undo = result.undo;
          if (undo) {
            // Geloeschtes liegt im Papierkorb - direkt zurueckholen
            toast.success(result.message ?? "Gelöscht", {
              timeout: 8000,
              actionProps: { children: "Rückgängig", onPress: () => void run(() => restoreFromTrash(undo)) },
            });
          } else if (result.message && !options.silent) {
            toast.success(result.message);
          }
          router.refresh();
          return true;
        }
        toast.danger(result.error);
        router.refresh();
        return false;
      } catch {
        toast.danger("Das hat nicht geklappt. Bitte prüfe deine Verbindung und versuche es erneut.");
        return false;
      } finally {
        setPending(false);
      }
    },
    [router],
  );

  return { run, pending };
}
