"use client";

import {
  Alert,
  Button,
  Card,
  FieldError,
  Form,
  Input,
  Label,
  Link,
  Modal,
  Spinner,
  TextField,
} from "@heroui/react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DiscordIcon, Logo } from "@/components/brand/logo";
import { authClient } from "@/lib/auth/client";
import { isStandalone } from "@/lib/utils";

const HANDOFF_KEY = "finanzen-login-handoff";

interface Handoff {
  code: string;
  secret: string;
  target: string;
}

function readHandoff(): Handoff | null {
  try {
    const raw = localStorage.getItem(HANDOFF_KEY);
    return raw ? (JSON.parse(raw) as Handoff) : null;
  } catch {
    return null;
  }
}

export function LoginCard({ target, error }: { target: string; error: string | null }) {
  const [pending, setPending] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(
    error ? "Die Anmeldung mit Discord hat nicht geklappt. Bitte versuche es erneut." : null,
  );
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = useCallback((to: string) => {
    localStorage.removeItem(HANDOFF_KEY);
    window.location.replace(to);
  }, []);

  // Installierte App: wartet, bis der Login im Browserfenster abgeschlossen ist.
  const poll = useCallback(async () => {
    const handoff = readHandoff();
    if (!handoff) return setWaiting(false);
    setWaiting(true);
    try {
      const res = await fetch("/api/auth/handoff/poll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: handoff.code, secret: handoff.secret }),
      });
      const data = (await res.json()) as { status?: "pending" | "done" | "expired" };
      if (data.status === "done") return finish(handoff.target);
      if (data.status === "expired") {
        localStorage.removeItem(HANDOFF_KEY);
        setWaiting(false);
        return;
      }
    } catch {
      // offline o. ä. – einfach weiter versuchen
    }
    pollTimer.current = setTimeout(poll, 1500);
  }, [finish]);

  useEffect(() => {
    if (readHandoff()) void poll();
    const onVisible = () => {
      if (document.visibilityState === "visible" && readHandoff()) {
        if (pollTimer.current) clearTimeout(pollTimer.current);
        void poll();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [poll]);

  async function signInWithDiscord() {
    setPending(true);
    setLoginError(null);
    try {
      let callbackURL = target;
      if (isStandalone()) {
        const res = await fetch("/api/auth/handoff/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        });
        if (res.ok) {
          const { code, secret } = (await res.json()) as { code: string; secret: string };
          localStorage.setItem(HANDOFF_KEY, JSON.stringify({ code, secret, target } satisfies Handoff));
          callbackURL = `/login/abschluss?code=${encodeURIComponent(code)}&weiter=${encodeURIComponent(target)}`;
        }
      }
      const { data, error: err } = await authClient.signIn.social({
        provider: "discord",
        callbackURL,
        errorCallbackURL: "/login?fehler=discord",
        disableRedirect: true,
      });
      if (err || !data?.url) throw new Error(err?.message ?? "Kein Login-Link erhalten");
      if (readHandoff()) void poll();
      window.location.href = data.url;
    } catch {
      setPending(false);
      setLoginError("Discord ist gerade nicht erreichbar. Versuche es später erneut oder nutze den Notfall-Login.");
    }
  }

  return (
    <Card className="w-full max-w-sm rounded-[2rem] p-2 shadow-overlay backdrop-blur-xl sm:p-4">
      <Card.Header className="items-center gap-3 pt-6 text-center">
        <Logo className="size-16 drop-shadow-lg" />
        <div className="space-y-1">
          <Card.Title className="text-2xl font-semibold tracking-tight">Finanzen</Card.Title>
          <Card.Description>Dein privater Überblick über Geld, Abos und Wünsche.</Card.Description>
        </div>
      </Card.Header>

      <Card.Content className="gap-4 pt-4">
        {loginError && (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Anmeldung fehlgeschlagen</Alert.Title>
              <Alert.Description>{loginError}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        {waiting ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface-secondary p-5 text-center">
            <Spinner />
            <p className="text-sm text-muted">
              Warte auf die Bestätigung von Discord … Kehre nach dem Login einfach hierher zurück.
            </p>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                localStorage.removeItem(HANDOFF_KEY);
                setWaiting(false);
                setPending(false);
              }}
            >
              Abbrechen
            </Button>
          </div>
        ) : (
          <Button
            fullWidth
            size="lg"
            isPending={pending}
            onPress={signInWithDiscord}
            className="h-14 rounded-2xl bg-[#5865F2] text-base font-semibold text-white shadow-[0_8px_24px_-8px_#5865F2] hover:bg-[#4752C4] data-[hovered=true]:bg-[#4752C4]"
          >
            {({ isPending }) => (
              <>
                {isPending ? <Spinner color="current" size="sm" /> : <DiscordIcon className="size-5" />}
                Mit Discord anmelden
              </>
            )}
          </Button>
        )}

        <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Nur für den freigeschalteten Discord-Account
        </p>
      </Card.Content>

      <Card.Footer className="justify-center pb-4">
        <EmergencyLogin target={target} />
      </Card.Footer>
    </Card>
  );
}

function EmergencyLogin({ target }: { target: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/emergency/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.replace(target);
        return;
      }
      if (res.status === 429) {
        const retry = Number(res.headers.get("x-retry-after") ?? res.headers.get("retry-after") ?? 0);
        const minutes = Math.max(1, Math.ceil(retry / 60));
        setError(`Zu viele Versuche. Bitte warte ${retry ? `${minutes} Minute${minutes === 1 ? "" : "n"}` : "15 Minuten"}.`);
      } else if (res.status === 401) {
        setError("Das Passwort ist falsch.");
      } else {
        setError("Notfall-Login ist nicht eingerichtet.");
      }
    } catch {
      setError("Keine Verbindung zum Server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal>
      <Link className="cursor-pointer text-xs text-muted">
        <KeyRound className="me-1 inline size-3" aria-hidden="true" />
        Notfall-Login
      </Link>
      <Modal.Backdrop>
        <Modal.Container placement="center">
          <Modal.Dialog className="sm:max-w-sm">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon className="bg-warning/15 text-warning">
                <KeyRound className="size-5" />
              </Modal.Icon>
              <Modal.Heading>Notfall-Login</Modal.Heading>
            </Modal.Header>
            <Form onSubmit={onSubmit} validationErrors={error ? { password: error } : undefined}>
              <Modal.Body className="gap-3">
                <p className="text-sm text-muted">
                  Nur nutzen, wenn Discord nicht erreichbar ist. Maximal 5 Versuche in 15 Minuten.
                </p>
                <TextField
                  name="password"
                  type="password"
                  isRequired
                  autoFocus
                  autoComplete="current-password"
                  isInvalid={!!error}
                  onChange={() => setError(null)}
                >
                  <Label>Notfall-Passwort</Label>
                  <Input placeholder="••••••••••••" />
                  <FieldError>{error ?? "Bitte Passwort eingeben."}</FieldError>
                </TextField>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="tertiary">
                  Abbrechen
                </Button>
                <Button type="submit" isPending={pending}>
                  Anmelden
                </Button>
              </Modal.Footer>
            </Form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
