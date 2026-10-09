"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { joinWaitlist, type WaitlistState } from "@/lib/server/actions/waitlist";
import { Button } from "@/ui/button";
import { cx } from "@/ui/cx";

export function WaitlistForm({ compact = false, className }: { compact?: boolean; className?: string }) {
  const [state, action, pending] = useActionState<WaitlistState, FormData>(joinWaitlist, { ok: false });
  // Kontrolliert, weil React Formulare nach dem Absenden sonst leert - auch bei Fehlern
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);

  if (state.ok) {
    return (
      <p role="status" className={cx("flex items-start gap-2.5 text-[15px] leading-relaxed", className)}>
        <CheckCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-pos" />
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className={cx("flex flex-col gap-3", className)} noValidate>
      <div className={cx("flex flex-col gap-2", !compact && "sm:flex-row")}>
        <label className="sr-only" htmlFor={compact ? "wl-email-c" : "wl-email"}>
          E-Mail-Adresse
        </label>
        <input
          id={compact ? "wl-email-c" : "wl-email"}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="deine@mail.de"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-12 min-w-0 flex-1 rounded-full border border-line-strong bg-surface px-5 text-[15px] placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
        {/* Honeypot fuer Bots - fuer Menschen unsichtbar */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
        <Button type="submit" variant="primary" pending={pending} className="h-12 px-6 text-[15px]">
          Auf die Warteliste
        </Button>
      </div>
      <label className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-3">
        <input type="checkbox" name="consent" required checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 size-3.5 shrink-0 accent-[var(--accent)]" />
        <span>
          Ich bin einverstanden, dass meine E-Mail-Adresse gespeichert wird, um mich über den Start zu informieren. Widerruf jederzeit
          per Mail. Mehr in der{" "}
          <Link href="/datenschutz" className="underline underline-offset-2 hover:text-ink">
            Datenschutzerklärung
          </Link>
          .
        </span>
      </label>
      {state.error ? (
        <p role="alert" className="text-[13px] text-neg">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
