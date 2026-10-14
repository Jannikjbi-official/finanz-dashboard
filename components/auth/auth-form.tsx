"use client";

import { LockKey } from "@phosphor-icons/react";
import { Button, Checkbox, Form, Spinner } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TextInput } from "@/components/forms/fields";
import { authClient } from "@/lib/client/auth-client";

const ERRORS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "E-Mail-Adresse oder Passwort ist falsch.",
  USER_ALREADY_EXISTS: "Für diese Adresse gibt es bereits ein Konto.",
  PASSWORD_TOO_SHORT: "Das Passwort muss mindestens 10 Zeichen lang sein.",
  INVALID_CODE: "Der Code ist ungültig oder abgelaufen.",
  INVALID_BACKUP_CODE: "Dieser Backup-Code ist ungültig oder wurde schon verwendet.",
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: "Zu viele Versuche. Bitte melde dich erneut an.",
  INVALID_TWO_FACTOR_COOKIE: "Die Anmeldung ist abgelaufen. Bitte erneut mit Passwort anmelden.",
};

function message(error: { code?: string; status?: number; message?: string }) {
  if (error.code && ERRORS[error.code]) return ERRORS[error.code];
  if (error.status === 429) return "Zu viele Versuche. Bitte warte einige Minuten.";
  if (error.status === 403) return error.message || "Für diese Adresse besteht kein Zugang.";
  return error.message || "Die Anmeldung hat nicht geklappt.";
}

function Brand() {
  return (
    <Link href="/" aria-label="Zur Startseite" className="mb-8 flex w-fit items-center gap-2.5 rounded-[var(--radius)] outline-none focus-visible:ring-2 focus-visible:ring-focus">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect width="32" height="32" rx="7" className="fill-surface-secondary" />
        <path d="M9 21.5h14" className="stroke-accent" strokeWidth="2" strokeLinecap="round" />
        <path d="M11 17.5V12M16 17.5V9M21 17.5v-3.5" className="stroke-foreground" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <div className="leading-tight">
        <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Jannikjbi</div>
        <div className="text-[15px] font-semibold">Finanzen</div>
      </div>
    </Link>
  );
}

function ErrorBox({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="rounded-[var(--radius)] bg-danger-soft px-3 py-2 text-[13px] text-danger-soft-foreground">
      {text}
    </p>
  );
}

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" fullWidth isPending={pending}>
      {({ isPending }) => (
        <>
          {isPending && <Spinner color="current" size="sm" />}
          {children}
        </>
      )}
    </Button>
  );
}

export function AuthForm({
  mode,
  next,
  discord,
  canRegister,
  locked,
  initialError = null,
}: {
  mode: "sign-in" | "sign-up";
  next: string;
  discord: boolean;
  canRegister: boolean;
  locked: boolean;
  /** Meldung aus /anmelden?error=... (z. B. abgelehnte Discord-Anmeldung). */
  initialError?: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [code, setCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const signUp = mode === "sign-up";

  const finish = () => {
    router.replace(next);
    router.refresh();
  };

  async function submitCredentials() {
    setPending(true);
    setError(null);
    try {
      if (signUp) {
        const result = await authClient.signUp.email({ name: name || email.split("@")[0], email, password });
        if (result.error) return setError(message(result.error));
        return finish();
      }
      const result = await authClient.signIn.email({ email, password });
      if (result.error) return setError(message(result.error));
      if ((result.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
        setPassword("");
        setStep("code");
        return;
      }
      finish();
    } finally {
      setPending(false);
    }
  }

  async function submitCode() {
    setPending(true);
    setError(null);
    try {
      const value = code.replace(/\s/g, "");
      const result = useBackup
        ? await authClient.twoFactor.verifyBackupCode({ code: value, trustDevice })
        : await authClient.twoFactor.verifyTotp({ code: value, trustDevice });
      if (result.error) {
        if (result.error.code === "INVALID_TWO_FACTOR_COOKIE" || result.error.code === "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE") {
          setStep("credentials");
          setCode("");
        }
        return setError(message(result.error));
      }
      finish();
    } finally {
      setPending(false);
    }
  }

  if (step === "code") {
    return (
      <div>
        <Brand />
        <div className="mb-1 flex items-center gap-2">
          <LockKey className="size-5 text-accent" />
          <h1 className="text-xl font-semibold">Bestätigungscode</h1>
        </div>
        <p className="text-muted">
          {useBackup
            ? "Gib einen deiner Backup-Codes ein. Jeder Code funktioniert nur einmal."
            : "Gib den 6-stelligen Code aus deiner Authenticator-App ein."}
        </p>
        <Form
          className="mt-6 flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submitCode();
          }}
        >
          <TextInput label={useBackup ? "Backup-Code" : "Code"} value={code} onChange={setCode} isRequired autoFocus maxLength={useBackup ? 24 : 8} />
          <Checkbox isSelected={trustDevice} onChange={setTrustDevice}>
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              Diesem Gerät 30 Tage vertrauen
            </Checkbox.Content>
          </Checkbox>
          <ErrorBox text={error} />
          <SubmitButton pending={pending}>Bestätigen</SubmitButton>
        </Form>
        <div className="mt-6 flex flex-wrap justify-between gap-3 text-[13px]">
          <button type="button" className="text-muted underline decoration-border underline-offset-4 hover:text-foreground" onClick={() => { setUseBackup((v) => !v); setCode(""); setError(null); }}>
            {useBackup ? "Code aus der App verwenden" : "Backup-Code verwenden"}
          </button>
          <button type="button" className="text-muted underline decoration-border underline-offset-4 hover:text-foreground" onClick={() => { setStep("credentials"); setCode(""); setError(null); }}>
            Zurück
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Brand />
      <h1 className="text-xl font-semibold">{signUp ? "Zugang einrichten" : "Anmelden"}</h1>
      <p className="mt-1 text-muted">{signUp ? "Nur für freigegebene Adressen." : "Private Finanzverwaltung."}</p>

      {locked ? (
        <p role="alert" className="mt-6 rounded-[var(--radius)] bg-warning-soft px-3 py-2 text-[13px] text-warning-soft-foreground">
          Der Zugang ist gesperrt, weil keine freigegebene Adresse hinterlegt ist. Setze <code>ALLOWED_EMAILS</code> in der
          Server-Konfiguration.
        </p>
      ) : (
        <Form
          className="mt-6 flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submitCredentials();
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
          <ErrorBox text={error} />
          <SubmitButton pending={pending}>{signUp ? "Zugang anlegen" : "Anmelden"}</SubmitButton>
          {discord && !signUp && (
            <Button variant="secondary" fullWidth onPress={() => authClient.signIn.social({ provider: "discord", callbackURL: next, errorCallbackURL: "/anmelden" })}>
              Mit Discord anmelden
            </Button>
          )}
        </Form>
      )}

      {signUp ? (
        <p className="mt-6 text-[13px] text-muted">
          Schon eingerichtet?{" "}
          <Link href="/anmelden" className="text-foreground underline decoration-border underline-offset-4">
            Anmelden
          </Link>
        </p>
      ) : (
        canRegister && (
          <p className="mt-6 text-[13px] text-muted">
            Erster Start?{" "}
            <Link href="/registrieren" className="text-foreground underline decoration-border underline-offset-4">
              Zugang einrichten
            </Link>
          </p>
        )
      )}
    </div>
  );
}
