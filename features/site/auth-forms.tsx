"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/ui/button";
import { Field, Input } from "@/ui/field";
import { FormError } from "@/ui/action-form";

/** Nur interne Ziele zulassen - sonst koennte ?next= auf fremde Seiten umleiten. */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
}

function DiscordButton({ next }: { next: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      className="h-11 w-full"
      pending={pending}
      onClick={() => startTransition(async () => void (await authClient.signIn.social({ provider: "discord", callbackURL: next })))}
    >
      Mit Discord anmelden
    </Button>
  );
}

export function SignInForm({ next, discord }: { next: string | null; discord: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const target = safeNext(next);

  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          startTransition(async () => {
            const { error: failure } = await authClient.signIn.email({ email, password });
            if (failure) {
              setError(
                failure.status === 429
                  ? "Zu viele Versuche. Bitte warte eine Minute."
                  : failure.status === 401 || failure.status === 400
                    ? "E-Mail oder Passwort stimmen nicht."
                    : (failure.message ?? "Anmeldung fehlgeschlagen."),
              );
              return;
            }
            router.push(target);
            router.refresh();
          });
        }}
      >
        <Field label="E-Mail" htmlFor="si-email">
          <Input id="si-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Passwort" htmlFor="si-password">
          <Input id="si-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <FormError error={error} />
        <Button type="submit" variant="primary" className="h-11" pending={pending}>
          Anmelden
        </Button>
      </form>
      {discord ? (
        <>
          <div className="flex items-center gap-3 text-[12px] text-ink-3">
            <span className="h-px flex-1 bg-line" /> oder <span className="h-px flex-1 bg-line" />
          </div>
          <DiscordButton next={target} />
        </>
      ) : null}
    </div>
  );
}

export function SignUpForm({ discord }: { discord: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          if (password.length < 10) {
            setError("Das Passwort braucht mindestens 10 Zeichen.");
            return;
          }
          startTransition(async () => {
            const { error: failure } = await authClient.signUp.email({ name: name.trim(), email, password });
            if (failure) {
              setError(
                failure.status === 403
                  ? "Für diese Adresse liegt noch keine Einladung vor."
                  : failure.status === 422 || failure.code === "USER_ALREADY_EXISTS"
                    ? "Zu dieser Adresse gibt es schon ein Konto."
                    : failure.status === 429
                      ? "Zu viele Versuche. Bitte später noch einmal."
                      : (failure.message ?? "Registrierung fehlgeschlagen."),
              );
              return;
            }
            router.push("/willkommen");
            router.refresh();
          });
        }}
      >
        <Field label="Name" htmlFor="su-name">
          <Input id="su-name" autoComplete="name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="E-Mail" htmlFor="su-email" hint="Die Adresse, an die deine Einladung ging.">
          <Input id="su-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Passwort" htmlFor="su-password" hint="Mindestens 10 Zeichen.">
          <Input id="su-password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <p className="text-[12.5px] leading-snug text-ink-3">
          Mit der Registrierung akzeptierst du, dass deine Angaben zur Bereitstellung des Kontos verarbeitet werden – siehe{" "}
          <Link href="/datenschutz" className="underline underline-offset-2 hover:text-ink">
            Datenschutz
          </Link>
          .
        </p>
        <FormError error={error} />
        <Button type="submit" variant="primary" className="h-11" pending={pending}>
          Konto anlegen
        </Button>
      </form>
      {discord ? <DiscordButton next="/willkommen" /> : null}
    </div>
  );
}
