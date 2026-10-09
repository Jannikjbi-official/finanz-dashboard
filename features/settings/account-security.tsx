"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/ui/button";
import { Field, Input } from "@/ui/field";
import { Confirm } from "@/ui/sheet";
import { FormError } from "@/ui/action-form";
import { useToast } from "@/ui/toast";

/** Konto endgueltig loeschen - mit Passwort bestaetigt. */
export function DeleteAccount({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function remove() {
    setError(null);
    startTransition(async () => {
      const { error: failure } = await authClient.deleteUser({ password: password || undefined });
      if (failure) {
        setError(failure.status === 400 || failure.status === 401 ? "Passwort stimmt nicht." : (failure.message ?? "Löschen fehlgeschlagen."));
        return;
      }
      router.push("/?konto=geloescht");
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Konto und alle Daten löschen
      </Button>
      <Confirm
        open={open}
        onOpenChange={setOpen}
        title="Konto endgültig löschen?"
        description="Alle Konten, Buchungen, Fixkosten, Ziele, Szenarien und Einstellungen werden sofort und unwiderruflich gelöscht. Lade vorher den vollständigen Export herunter, wenn du die Daten behalten möchtest."
      >
        <div className="flex w-full flex-col gap-3">
          <Field label="Passwort" htmlFor="del-password">
            <Input id="del-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label={`Zur Bestätigung „${email}“ eingeben`} htmlFor="del-confirm">
            <Input id="del-confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
          </Field>
          <FormError error={error} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button variant="danger" onClick={remove} pending={pending} disabled={confirmText.trim().toLowerCase() !== email.toLowerCase()}>
              Endgültig löschen
            </Button>
          </div>
        </div>
      </Confirm>
    </>
  );
}

export function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  return (
    <form
      className="flex max-w-md flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        if (next.length < 10) {
          setError("Das neue Passwort braucht mindestens 10 Zeichen.");
          return;
        }
        startTransition(async () => {
          const { error: failure } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
          if (failure) setError(failure.status === 400 ? "Das aktuelle Passwort stimmt nicht." : (failure.message ?? "Ändern fehlgeschlagen."));
          else {
            setCurrent("");
            setNext("");
            toast("Passwort geändert – andere Geräte wurden abgemeldet");
          }
        });
      }}
    >
      <Field label="Aktuelles Passwort" htmlFor="pw-current">
        <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </Field>
      <Field label="Neues Passwort" htmlFor="pw-next" hint="Mindestens 10 Zeichen. Ein langer Satz ist sicherer als ein kurzes Sonderzeichen-Passwort.">
        <Input id="pw-next" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
      </Field>
      <FormError error={error} />
      <Button type="submit" pending={pending} className="self-start">
        Passwort ändern
      </Button>
    </form>
  );
}

type SessionRow = { id: string; token: string; userAgent?: string | null; ipAddress?: string | null; createdAt: Date | string; updatedAt: Date | string };

function describeAgent(agent: string | null | undefined) {
  if (!agent) return "Unbekanntes Gerät";
  const browser = /Edg\//.test(agent) ? "Edge" : /Firefox\//.test(agent) ? "Firefox" : /Chrome\//.test(agent) ? "Chrome" : /Safari\//.test(agent) ? "Safari" : "Browser";
  const system = /iPhone|iPad/.test(agent) ? "iOS" : /Android/.test(agent) ? "Android" : /Windows/.test(agent) ? "Windows" : /Mac OS/.test(agent) ? "macOS" : /Linux/.test(agent) ? "Linux" : "";
  return system ? `${browser} auf ${system}` : browser;
}

export function Sessions({ currentToken }: { currentToken: string | null }) {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  async function load() {
    const { data } = await authClient.listSessions();
    setSessions((data as SessionRow[] | null) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  if (sessions === null) return <p className="text-[14px] text-ink-3">Lädt …</p>;

  const others = sessions.filter((s) => s.token !== currentToken);

  return (
    <div className="flex flex-col gap-4">
      <ul className="border-t border-line">
        {sessions.map((session) => (
          <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3">
            <div>
              <p className="text-[14px]">
                {describeAgent(session.userAgent)}
                {session.token === currentToken ? <span className="ml-2 text-[12px] text-pos">dieses Gerät</span> : null}
              </p>
              <p className="text-[12px] text-ink-3">
                Zuletzt aktiv {new Date(session.updatedAt).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
            {session.token !== currentToken ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  startTransition(async () => {
                    await authClient.revokeSession({ token: session.token });
                    toast("Gerät abgemeldet");
                    await load();
                  })
                }
              >
                Abmelden
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {others.length > 0 ? (
        <Button
          className="self-start"
          pending={pending}
          onClick={() =>
            startTransition(async () => {
              await authClient.revokeOtherSessions();
              toast("Alle anderen Geräte abgemeldet");
              await load();
            })
          }
        >
          Alle anderen abmelden
        </Button>
      ) : null}
    </div>
  );
}
