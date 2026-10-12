"use client";

import { CheckCircle, Copy, DownloadSimple, ShieldCheck, Warning } from "@phosphor-icons/react";
import { Button, toast } from "@heroui/react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { TextInput } from "@/components/forms/fields";
import { FormDialog } from "@/components/forms/form-dialog";
import { Panel } from "@/components/ui/panel";
import { authClient } from "@/lib/client/auth-client";
import { useAction } from "@/lib/client/use-action";
import { revokeOtherSessionsAction, revokeSessionById } from "@/lib/server/actions/security";
import type { SessionInfo } from "@/lib/server/security";

type Overview = { twoFactorEnabled: boolean; hasPassword: boolean; providers: string[]; sessions: SessionInfo[] };

const ERRORS: Record<string, string> = {
  INVALID_PASSWORD: "Das Passwort ist falsch.",
  INVALID_CODE: "Der Code stimmt nicht. Prüfe die Uhrzeit deines Geräts und versuche den nächsten Code.",
  PASSWORD_TOO_SHORT: "Das neue Passwort muss mindestens 10 Zeichen lang sein.",
  TOTP_ALREADY_ENABLED: "Die Zwei-Faktor-Anmeldung ist bereits aktiv.",
};

function errorText(error: { code?: string; status?: number; message?: string }) {
  if (error.code && ERRORS[error.code]) return ERRORS[error.code];
  if (error.status === 429) return "Zu viele Versuche. Bitte warte einige Minuten.";
  return error.message || "Das hat nicht geklappt.";
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

function BackupCodes({ codes }: { codes: string[] }) {
  const text = codes.join("\n");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2 rounded-[var(--radius)] bg-warning-soft px-3 py-2 text-[13px] text-warning-soft-foreground">
        <Warning className="mt-0.5 size-4 shrink-0" />
        <span>
          Bewahre diese Codes sicher auf (z. B. im Passwortmanager). Jeder Code funktioniert einmal, falls du keinen Zugriff auf die
          Authenticator-App hast. Sie werden nur jetzt angezeigt.
        </span>
      </div>
      <ul className="num grid grid-cols-2 gap-x-6 gap-y-1 rounded-[var(--radius)] border border-border px-4 py-3 font-mono text-[13px]">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          onPress={async () => {
            await navigator.clipboard.writeText(text);
            toast.success("Backup-Codes kopiert");
          }}
        >
          <Copy className="size-4" /> Kopieren
        </Button>
        <a
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(`Jannikjbi Finanzen – Backup-Codes\n\n${text}\n`)}`}
          download="finanzen-backup-codes.txt"
          className="inline-flex h-8 items-center gap-2 rounded-[var(--radius)] bg-default px-3 text-sm font-medium hover:bg-default-hover"
        >
          <DownloadSimple className="size-4" /> Als Datei
        </a>
      </div>
    </div>
  );
}

/** Einrichtung: Passwort bestaetigen -> QR-Code scannen -> Code pruefen -> Backup-Codes sichern. */
function EnableTwoFactorDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState<"password" | "scan" | "codes">("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [uri, setUri] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uri) return;
    QRCode.toDataURL(uri, { margin: 1, width: 352, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } }).then(setQr);
  }, [uri]);

  const secret = uri ? new URL(uri).searchParams.get("secret") : null;

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) {
      onClose();
      router.refresh();
    }
  };

  async function submit() {
    setPending(true);
    setError(null);
    try {
      if (step === "password") {
        const result = await authClient.twoFactor.enable({ password, method: "totp" });
        if (result.error) return (setError(errorText(result.error)), false);
        if (result.data.method !== "totp") return (setError("Die Einrichtung hat nicht geklappt."), false);
        setUri(result.data.totpURI);
        setBackupCodes(result.data.backupCodes);
        setPassword("");
        setStep("scan");
        return false;
      }
      if (step === "scan") {
        const result = await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, "") });
        if (result.error) return (setError(errorText(result.error)), false);
        setStep("codes");
        toast.success("Zwei-Faktor-Anmeldung ist aktiv");
        return false;
      }
      return true;
    } finally {
      setPending(false);
    }
  }

  return (
    <FormDialog
      isOpen={open}
      onOpenChange={close}
      title="Zwei-Faktor-Anmeldung einrichten"
      description={step === "password" ? "Schritt 1 von 3" : step === "scan" ? "Schritt 2 von 3" : "Schritt 3 von 3"}
      submitLabel={step === "password" ? "Weiter" : step === "scan" ? "Code prüfen" : "Codes sind gesichert"}
      pending={pending}
      onSubmit={submit}
    >
      {step === "password" && (
        <>
          <p className="text-muted">
            Nach der Einrichtung brauchst du bei jeder Anmeldung zusätzlich einen Code aus einer Authenticator-App (z. B. Apple Passwörter,
            Google Authenticator, 1Password, Bitwarden).
          </p>
          <TextInput label="Aktuelles Passwort" type="password" value={password} onChange={setPassword} isRequired autoFocus />
        </>
      )}
      {step === "scan" && (
        <>
          <p className="text-muted">Scanne den QR-Code mit deiner Authenticator-App und gib den angezeigten Code ein.</p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <div className="size-44 shrink-0 overflow-hidden rounded-[var(--radius)] bg-white p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {qr && <img src={qr} alt="QR-Code für die Authenticator-App" className="size-full" />}
            </div>
            <div className="min-w-0 text-[13px]">
              <div className="label">Oder Schlüssel manuell eingeben</div>
              <code className="mt-1 block break-all rounded-[var(--radius)] bg-surface-secondary px-2 py-1.5 font-mono">{secret}</code>
            </div>
          </div>
          <TextInput label="Code aus der App" value={code} onChange={setCode} isRequired autoFocus maxLength={8} />
        </>
      )}
      {step === "codes" && (
        <>
          <p className="flex items-center gap-2 font-medium">
            <CheckCircle weight="fill" className="size-5 text-success" /> Die Zwei-Faktor-Anmeldung ist aktiv.
          </p>
          <BackupCodes codes={backupCodes} />
        </>
      )}
      {error && <p className="rounded-[var(--radius)] bg-danger-soft px-3 py-2 text-[13px] text-danger-soft-foreground">{error}</p>}
    </FormDialog>
  );
}

/** Passwortabfrage fuer Deaktivieren und neue Backup-Codes. */
function PasswordActionDialog({
  kind,
  onClose,
}: {
  kind: "disable" | "backup";
  onClose: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) {
      onClose();
      router.refresh();
    }
  };

  return (
    <FormDialog
      isOpen={open}
      onOpenChange={close}
      title={kind === "disable" ? "Zwei-Faktor-Anmeldung ausschalten" : "Neue Backup-Codes erzeugen"}
      submitLabel={codes ? "Fertig" : kind === "disable" ? "Ausschalten" : "Erzeugen"}
      pending={pending}
      onSubmit={async () => {
        if (codes) return true;
        setPending(true);
        setError(null);
        try {
          if (kind === "disable") {
            const result = await authClient.twoFactor.disable({ password });
            if (result.error) return (setError(errorText(result.error)), false);
            toast.success("Zwei-Faktor-Anmeldung ausgeschaltet");
            return true;
          }
          const result = await authClient.twoFactor.generateBackupCodes({ password });
          if (result.error) return (setError(errorText(result.error)), false);
          setCodes(result.data.backupCodes);
          return false;
        } finally {
          setPending(false);
        }
      }}
    >
      {codes ? (
        <BackupCodes codes={codes} />
      ) : (
        <>
          <p className="text-muted">
            {kind === "disable"
              ? "Danach reicht wieder das Passwort zur Anmeldung. Das senkt den Schutz deiner Finanzdaten."
              : "Die bisherigen Backup-Codes werden ungültig."}
          </p>
          <TextInput label="Passwort" type="password" value={password} onChange={setPassword} isRequired autoFocus />
        </>
      )}
      {error && <p className="rounded-[var(--radius)] bg-danger-soft px-3 py-2 text-[13px] text-danger-soft-foreground">{error}</p>}
    </FormDialog>
  );
}

function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <FormDialog
      isOpen={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) onClose();
      }}
      title="Passwort ändern"
      description="Alle anderen Sitzungen werden dabei abgemeldet."
      pending={pending}
      onSubmit={async () => {
        setError(null);
        if (next.length < 10) return (setError("Das neue Passwort muss mindestens 10 Zeichen lang sein."), false);
        if (next !== repeat) return (setError("Die beiden neuen Passwörter stimmen nicht überein."), false);
        setPending(true);
        try {
          const result = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
          if (result.error) return (setError(errorText(result.error)), false);
          toast.success("Passwort geändert, andere Sitzungen abgemeldet");
          router.refresh();
          return true;
        } finally {
          setPending(false);
        }
      }}
    >
      <TextInput label="Aktuelles Passwort" type="password" value={current} onChange={setCurrent} isRequired autoFocus />
      <TextInput label="Neues Passwort" type="password" value={next} onChange={setNext} isRequired description="Mindestens 10 Zeichen." />
      <TextInput label="Neues Passwort wiederholen" type="password" value={repeat} onChange={setRepeat} isRequired />
      {error && <p className="rounded-[var(--radius)] bg-danger-soft px-3 py-2 text-[13px] text-danger-soft-foreground">{error}</p>}
    </FormDialog>
  );
}

export function SecurityPanel({ overview }: { overview: Overview }) {
  const { run, pending } = useAction();
  const [dialog, setDialog] = useState<"enable" | "disable" | "backup" | "password" | "others" | null>(null);
  const others = overview.sessions.filter((session) => !session.current);

  return (
    <Panel title="Sicherheit" description="Zugang zu deinen Finanzdaten" className="lg:col-span-2" bodyClassName="flex flex-col divide-y divide-separator">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <ShieldCheck weight={overview.twoFactorEnabled ? "fill" : "regular"} className={`mt-0.5 size-5 shrink-0 ${overview.twoFactorEnabled ? "text-success" : "text-warning"}`} />
          <div>
            <div className="font-medium">Zwei-Faktor-Anmeldung {overview.twoFactorEnabled ? "aktiv" : "aus"}</div>
            <div className="label font-normal">
              {overview.twoFactorEnabled
                ? "Anmeldung nur mit Passwort und Code aus der Authenticator-App. Discord-Anmeldung ist dafür gesperrt."
                : "Empfohlen: Ohne Code aus deiner Authenticator-App kommt niemand hinein – auch nicht mit deinem Passwort."}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {overview.twoFactorEnabled ? (
            <>
              <Button size="sm" variant="ghost" onPress={() => setDialog("backup")}>
                Neue Backup-Codes
              </Button>
              <Button size="sm" variant="secondary" onPress={() => setDialog("disable")}>
                Ausschalten
              </Button>
            </>
          ) : overview.hasPassword ? (
            <Button size="sm" onPress={() => setDialog("enable")}>
              Einrichten
            </Button>
          ) : (
            <span className="label max-w-56 font-normal">Setze zuerst ein Passwort – die Einrichtung braucht es zur Bestätigung.</span>
          )}
        </div>
      </div>

      {overview.hasPassword && (
        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <div className="font-medium">Passwort</div>
            <div className="label font-normal">Mindestens 10 Zeichen. Beim Ändern werden alle anderen Geräte abgemeldet.</div>
          </div>
          <Button size="sm" variant="secondary" onPress={() => setDialog("password")}>
            Passwort ändern
          </Button>
        </div>
      )}

      <div className="pt-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium">Angemeldete Geräte</div>
            <div className="label font-normal">Sitzungen enden nach 7 Tagen ohne Nutzung. Unbekanntes Gerät? Beenden und Passwort ändern.</div>
          </div>
          {others.length > 0 && (
            <Button size="sm" variant="secondary" onPress={() => setDialog("others")}>
              Alle anderen abmelden
            </Button>
          )}
        </div>
        <ul className="rows">
          {overview.sessions.map((session) => (
            <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span>{session.device}</span>
                  {session.current && <span className="rounded-[4px] bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent-soft-foreground">Dieses Gerät</span>}
                </div>
                <div className="label font-normal">
                  {session.ipAddress ? `${session.ipAddress} · ` : ""}zuletzt aktiv {formatDateTime(session.lastActiveAt)} · angemeldet {formatDateTime(session.createdAt)}
                </div>
              </div>
              {!session.current && (
                <Button size="sm" variant="ghost" className="text-muted" isPending={pending} onPress={() => run(() => revokeSessionById(session.id))}>
                  Beenden
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {dialog === "enable" && <EnableTwoFactorDialog onClose={() => setDialog(null)} />}
      {(dialog === "disable" || dialog === "backup") && <PasswordActionDialog kind={dialog} onClose={() => setDialog(null)} />}
      {dialog === "password" && <ChangePasswordDialog onClose={() => setDialog(null)} />}
      <ConfirmDialog
        isOpen={dialog === "others"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Alle anderen Geräte abmelden?"
        confirmLabel="Abmelden"
        tone="default"
        pending={pending}
        onConfirm={() => run(() => revokeOtherSessionsAction())}
      >
        <p>{others.length === 1 ? "1 weitere Sitzung wird beendet." : `${others.length} weitere Sitzungen werden beendet.`} Dieses Gerät bleibt angemeldet.</p>
      </ConfirmDialog>
    </Panel>
  );
}
