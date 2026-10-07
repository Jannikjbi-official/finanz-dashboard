"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/actions";
import { useToast } from "./toast";
import { cx } from "./cx";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Formular fuer eine Server Action: zeigt Fehler im Formular, Erfolg als
 * kurze Meldung und ruft danach `onSuccess` (z. B. Sheet schliessen).
 */
export function ActionForm({
  action,
  onSuccess,
  children,
  className,
  id,
  silent = false,
}: {
  action: Action;
  onSuccess?: (state: ActionState) => void;
  children: (state: { pending: boolean; error: string | null }) => React.ReactNode;
  className?: string;
  id?: string;
  /** Keine Erfolgsmeldung (z. B. bei Schaltern). */
  silent?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { ok: false });
  const toast = useToast();
  const handled = useRef<ActionState | null>(null);

  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (state.ok) {
      if (!silent && state.message) toast(state.message);
      onSuccess?.(state);
    }
  }, [state, toast, onSuccess, silent]);

  return (
    <form id={id} action={formAction} className={cx(className)} noValidate>
      {children({ pending, error: state.ok ? null : (state.error ?? null) })}
    </form>
  );
}

export function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-sm border border-neg/30 bg-neg-soft px-3 py-2 text-[13px] text-neg">
      {error}
    </p>
  );
}
