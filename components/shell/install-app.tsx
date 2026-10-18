"use client";

import { DeviceMobile, DownloadSimple, Export, PlusSquare, X } from "@phosphor-icons/react";
import { Button, toast } from "@heroui/react";
import { useEffect, useState } from "react";
import { Panel } from "@/components/ui/panel";
import { useInstall, type InstallState } from "@/lib/client/install";

/** Anleitung fuer Browser ohne Installieren-Knopf. */
function Steps({ state }: { state: InstallState }) {
  if (state === "ios") {
    const icon = "inline size-4 align-[-3px]";
    return (
      <ol className="flex flex-col gap-1.5 text-[13.5px]">
        <li className="flex gap-2">
          <span className="label w-4 shrink-0 font-normal">1.</span>
          <span>
            In Safari unten auf <Export className={icon} aria-label="Teilen" /> <b className="font-medium">Teilen</b> tippen
          </span>
        </li>
        <li className="flex gap-2">
          <span className="label w-4 shrink-0 font-normal">2.</span>
          <span>
            <PlusSquare className={icon} aria-hidden /> <b className="font-medium">Zum Home-Bildschirm</b> wählen
          </span>
        </li>
        <li className="flex gap-2">
          <span className="label w-4 shrink-0 font-normal">3.</span>
          <span>
            <b className="font-medium">Hinzufügen</b> – fertig, „Finanzen“ liegt bei den Apps
          </span>
        </li>
      </ol>
    );
  }
  if (state === "mac-safari") {
    return (
      <p className="text-[13.5px]">
        In der Menüleiste <b className="font-medium">Ablage → Zum Dock hinzufügen</b> wählen.
      </p>
    );
  }
  return (
    <p className="text-[13.5px]">
      Im Browsermenü <b className="font-medium">„App installieren“</b> bzw. <b className="font-medium">„Zum Startbildschirm hinzufügen“</b> wählen. Am
      einfachsten mit Chrome, Edge oder auf dem iPhone mit Safari.
    </p>
  );
}

function useInstallAction() {
  const { state, install } = useInstall();
  const run = async () => {
    if (await install()) toast.success("Installiert – „Finanzen“ liegt jetzt bei deinen Apps.");
  };
  return { state, run };
}

/** Einstellungen: Installieren-Knopf bzw. Anleitung. */
export function InstallPanel() {
  const { state, run } = useInstallAction();
  return (
    <Panel id="app" className="lg:self-start" title="Als App nutzen" description="Öffnet sich ohne Browserleiste wie eine eigene App, mit Symbol auf dem Startbildschirm. Kein App Store nötig.">
      {state === "unknown" ? null : state === "installed" ? (
        <p className="flex items-center gap-2 text-[13.5px]">
          <DeviceMobile className="size-4 text-success" aria-hidden /> Läuft als installierte App.
        </p>
      ) : state === "prompt" ? (
        <Button size="sm" onPress={run}>
          <DownloadSimple className="size-4" /> App installieren
        </Button>
      ) : (
        <Steps state={state} />
      )}
    </Panel>
  );
}

const DISMISSED = "install-hint-dismissed";

/**
 * Einmaliger Hinweis auf der Uebersicht, solange die App nicht installiert
 * ist und der Browser es kann (Knopf) bzw. auf dem iPhone. "Später"
 * blendet ihn dauerhaft aus; unter Einstellungen geht es weiter.
 */
export function InstallHint() {
  const { state, run } = useInstallAction();
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISSED) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);
  if (dismissed || (state !== "prompt" && state !== "ios")) return null;

  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {
      // ohne Speicher erscheint der Hinweis beim naechsten Mal wieder
    }
  };

  return (
    <aside className="panel relative flex flex-col gap-3 px-4 py-3 pr-10 sm:flex-row sm:items-center sm:justify-between sm:px-5" aria-label="Als App installieren">
      <div className="min-w-0 text-[13.5px]">
        <div className="flex items-center gap-2 font-medium">
          <DeviceMobile className="size-4 text-accent" aria-hidden /> Finanzen als App
        </div>
        {state === "ios" ? (
          <div className="mt-2">
            <Steps state="ios" />
          </div>
        ) : (
          <p className="text-muted">Mit Symbol auf dem Startbildschirm, ohne Browserleiste.</p>
        )}
      </div>
      {state === "prompt" && (
        <Button size="sm" className="shrink-0 self-start sm:self-center" onPress={run}>
          <DownloadSimple className="size-4" /> Installieren
        </Button>
      )}
      <button type="button" onClick={close} aria-label="Hinweis ausblenden" className="absolute right-2 top-2 rounded-[var(--radius)] p-1 text-muted hover:bg-default hover:text-foreground">
        <X className="size-4" />
      </button>
    </aside>
  );
}

/** Oeffentliche Startseite: ohne HeroUI, nur ein Knopf bzw. die Anleitung. */
export function SiteInstall() {
  const { state, run } = useInstallAction();
  if (state === "unknown" || state === "installed") return null;
  if (state === "prompt") {
    return (
      <button
        type="button"
        onClick={run}
        className="inline-flex h-9 items-center gap-2 rounded-[var(--radius)] bg-default px-4 text-sm font-medium text-foreground hover:bg-default-hover"
      >
        <DownloadSimple className="size-4" /> App installieren
      </button>
    );
  }
  return (
    <div className="text-muted">
      <Steps state={state} />
    </div>
  );
}
