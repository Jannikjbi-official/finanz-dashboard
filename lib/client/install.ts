"use client";

import { useSyncExternalStore } from "react";

/**
 * Installieren als App (PWA). Chrome, Edge und Android melden mit
 * "beforeinstallprompt", dass sie installieren koennen - das Ereignis kommt
 * einmal kurz nach dem Laden und wird hier fuer den eigenen Knopf
 * aufgehoben. Safari auf dem iPhone kennt das nicht: dort hilft nur die
 * Anleitung "Teilen -> Zum Home-Bildschirm".
 */

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export type InstallState =
  /** Vor dem ersten Rendern im Browser. */
  | "unknown"
  /** Laeuft schon als installierte App. */
  | "installed"
  /** Der Browser kann direkt installieren (Knopf). */
  | "prompt"
  /** iPhone/iPad: ueber "Teilen". */
  | "ios"
  /** Safari auf dem Mac: Ablage -> Zum Dock hinzufuegen. */
  | "mac-safari"
  /** Sonst: Browsermenue. */
  | "manual";

let deferred: PromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Eigener Knopf statt der Leiste des Browsers
    event.preventDefault();
    deferred = event as PromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installedNow = true;
    deferred = null;
    notify();
  });
}

function standalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function current(): InstallState {
  if (installedNow || standalone()) return "installed";
  if (deferred) return "prompt";
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return "ios";
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua)) return "mac-safari";
  return "manual";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", listener);
  };
}

export function useInstall() {
  const state = useSyncExternalStore(subscribe, current, () => "unknown" as InstallState);
  const install = async () => {
    if (!deferred) return false;
    const event = deferred;
    await event.prompt();
    const { outcome } = await event.userChoice;
    // Das Ereignis gilt nur einmal
    deferred = null;
    if (outcome === "accepted") installedNow = true;
    notify();
    return outcome === "accepted";
  };
  return { state, install };
}
