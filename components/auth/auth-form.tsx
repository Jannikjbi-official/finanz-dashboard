"use client";

import { Button, Form, Spinner } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TextInput } from "@/components/forms/fields";
import { authClient } from "@/lib/client/auth-client";

const ERRORS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "E-Mail-Adresse oder Passwort ist falsch.",
  USER_ALREADY_EXISTS: "Für diese Adresse gibt es bereits ein Konto.",
  PASSWORD_TOO_SHORT: "Das Passwort muss mindestens 10 Zeichen lang sein.",
  FORBIDDEN: "Diese Adresse ist für diese Anwendung nicht freigeschaltet.",
};

export function AuthForm({ mode, next, discord }: { mode: "sign-in" | "sign-up"; next: string; discord: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const signUp = mode === "sign-up";

  async function submit() {
    setPending(true);
    setError(null);
    const result = signUp
      ? await authClient.signUp.email({ name: name || email.split("@")[0], email, password })
      : await authClient.signIn.email({ email, password });
    setPending(false);
    if (result.error) {
      const code = result.error.code ?? "";
      setError(ERRORS[code] ?? (result.error.status === 429 ? "Zu viele Versuche. Bitte warte eine Minute." : result.error.message ?? "Anmeldung fehlgeschlagen."));
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-8 flex items-center gap-2.5">
        <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
          <rect width="32" height="32" rx="7" className="fill-surface-secondary" />
          <path d="M9 21.5h14" className="stroke-accent" strokeWidth="2" strokeLinecap="round" />
          <path d="M11 17.5V12M16 17.5V9M21 17.5v-3.5" className="stroke-foreground" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
        <div className="leading-tight">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Jannikjbi</div>
          <div className="text-[15px] font-semibold">Finanzen</div>
        </div>
      </div>

      <h1 className="text-xl font-semibold">{signUp ? "Zugang einrichten" : "Anmelden"}</h1>
      <p className="mt-1 text-muted">
        {signUp ? "Nur für freigeschaltete Adressen." : "Private Finanzverwaltung. Bitte melde dich an."}
      </p>

      <Form
        className="mt-6 flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {signUp && <TextInput label="Name" value={name} onChange={setName} maxLength={60} />}
        <TextInput label="E-Mail" type="email" value={email} onChange={setEmail} isRequired autoFocus />
        <TextInput
          label="Passwort"
          type="password"
          value={password}
          onChange={setPassword}
          isRequired
          description={signUp ? "Mindestens 10 Zeichen." : undefined}
        />
        {error && (
          <p role="alert" className="rounded-[var(--radius)] bg-danger-soft px-3 py-2 text-[13px] text-danger-soft-foreground">
            {error}
          </p>
        )}
        <Button type="submit" fullWidth isPending={pending}>
          {({ isPending }) => (
            <>
              {isPending && <Spinner color="current" size="sm" />}
              {signUp ? "Zugang anlegen" : "Anmelden"}
            </>
          )}
        </Button>
        {discord && !signUp && (
          <Button
            variant="secondary"
            fullWidth
            onPress={() => authClient.signIn.social({ provider: "discord", callbackURL: next })}
          >
            Mit Discord anmelden
          </Button>
        )}
      </Form>

      <p className="mt-6 text-[13px] text-muted">
        {signUp ? (
          <>
            Schon eingerichtet?{" "}
            <Link href="/anmelden" className="text-foreground underline decoration-border underline-offset-4">
              Anmelden
            </Link>
          </>
        ) : (
          <>
            Erster Start?{" "}
            <Link href="/registrieren" className="text-foreground underline decoration-border underline-offset-4">
              Zugang einrichten
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
