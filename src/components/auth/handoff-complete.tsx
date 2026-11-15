"use client";

import { Button, Card, Spinner } from "@heroui/react";
import { CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { isStandalone } from "@/lib/utils";

type State = "working" | "done-here" | "done-elsewhere" | "failed";

/**
 * Ziel des Discord-Callbacks, wenn der Login aus der installierten App kam.
 * Bestätigt die Übergabe; läuft diese Seite bereits in der App, geht es direkt weiter.
 */
export function HandoffComplete({ code, target }: { code: string | null; target: string }) {
  const [state, setState] = useState<State>("working");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!code) return setState("failed");
      try {
        const res = await fetch("/api/auth/handoff/complete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code }),
        });
        if (!res.ok) throw new Error();
        if (cancelled) return;
        if (isStandalone()) {
          localStorage.removeItem("finanzen-login-handoff");
          window.location.replace(target);
          setState("done-here");
        } else {
          setState("done-elsewhere");
        }
      } catch {
        if (!cancelled) setState("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, target]);

  return (
    <Card className="animate-fade-up w-full max-w-sm rounded-[2rem] p-4 text-center">
      <Card.Content className="items-center gap-4 py-6">
        {state === "working" || state === "done-here" ? (
          <>
            <Spinner size="lg" />
            <p className="text-muted">Anmeldung wird abgeschlossen …</p>
          </>
        ) : state === "done-elsewhere" ? (
          <>
            <CheckCircle2 className="size-12 text-success" aria-hidden="true" />
            <Card.Title className="text-xl">Angemeldet</Card.Title>
            <p className="text-sm text-muted">
              Du kannst dieses Fenster schließen und zur installierten App zurückkehren – sie meldet dich automatisch an.
            </p>
            <Button variant="secondary" onPress={() => window.location.replace(target)}>
              Hier im Browser weiter
            </Button>
          </>
        ) : (
          <>
            <XCircle className="size-12 text-danger" aria-hidden="true" />
            <Card.Title className="text-xl">Das hat nicht geklappt</Card.Title>
            <p className="text-sm text-muted">Der Login-Link ist abgelaufen. Bitte starte die Anmeldung neu.</p>
            <Button onPress={() => window.location.replace("/login")}>Zum Login</Button>
          </>
        )}
      </Card.Content>
    </Card>
  );
}
