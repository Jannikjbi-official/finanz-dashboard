"use client";

import { Button, Card, CloseButton, toast } from "@heroui/react";
import { Download, Share, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { signOut } from "@/lib/client/sign-out";
import { flushQueue, onQueueChange, readQueue } from "@/lib/client/offline-queue";
import { isStandalone } from "@/lib/utils";
import { useQuickAdd } from "./quick-add";

/* ── Installations-Store (beforeinstallprompt) ───────────────────────────── */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    emit();
  });
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Für den „App installieren“-Button in den Einstellungen. */
export function useInstallPrompt() {
  const canPrompt = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => !!deferredPrompt,
    () => false,
  );
  const installed = useSyncExternalStore(
    () => () => {},
    () => isStandalone(),
    () => false,
  );
  return {
    canPrompt,
    installed,
    ios: typeof window !== "undefined" && isIos(),
    async install() {
      if (!deferredPrompt) return false;
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      emit();
      return outcome === "accepted";
    },
  };
}

/* ── Hintergrunddienste ──────────────────────────────────────────────────── */

const INSTALL_HINT_KEY = "finanzen-install-hint-dismissed";
export const LOCK_KEY = "finanzen-lock-minutes";
const ACTIVITY_KEY = "finanzen-last-activity";

export function BackgroundServices() {
  return (
    <>
      <ServiceWorker />
      <OfflineSync />
      <Shortcuts />
      <InstallHint />
      <InactivityLock />
    </>
  );
}

function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}

function OfflineSync() {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    setOnline(navigator.onLine);
    setPending(readQueue().length);
    const sync = async () => {
      const saved = await flushQueue();
      if (saved > 0) {
        toast.success(`${saved} offline erfasste${saved === 1 ? "r Eintrag" : " Einträge"} synchronisiert`);
        router.refresh();
      }
    };
    const goOnline = () => {
      setOnline(true);
      void sync();
    };
    const goOffline = () => setOnline(false);
    const onVisible = () => document.visibilityState === "visible" && void sync();
    void sync();
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    document.addEventListener("visibilitychange", onVisible);
    const off = onQueueChange(setPending);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      document.removeEventListener("visibilitychange", onVisible);
      off();
    };
  }, [router]);

  if (online && pending === 0) return null;
  return (
    <div
      role="status"
      className="pt-safe pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 lg:top-2"
    >
      <div className="animate-fade-up mt-2 flex items-center gap-2 rounded-full bg-warning px-4 py-1.5 text-xs font-medium text-warning-foreground shadow-overlay">
        <WifiOff className="size-3.5" aria-hidden="true" />
        {online ? `${pending} Einträge werden synchronisiert …` : `Offline${pending ? ` · ${pending} in Warteschlange` : ""}`}
      </div>
    </div>
  );
}

/** Tastaturkürzel: N = neue Ausgabe, / = Suche */
function Shortcuts() {
  const { openExpense } = useQuickAdd();
  const router = useRouter();

  // App-Shortcut „Ausgabe hinzufügen“ (…?neu=1)
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("neu") === "1") {
      url.searchParams.delete("neu");
      window.history.replaceState(null, "", url.pathname + url.search);
      openExpense();
    }
  }, [openExpense]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.closest("[role=dialog]"))) {
        return;
      }
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        openExpense();
      } else if (e.key === "/") {
        e.preventDefault();
        const search = document.querySelector<HTMLInputElement>("[data-app-search] input");
        if (search) search.focus();
        else router.push("/ausgaben?suche=1");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openExpense, router]);
  return null;
}

/** Eigener „App installieren“-Hinweis beim ersten Besuch. */
function InstallHint() {
  const { canPrompt, installed, ios, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(INSTALL_HINT_KEY) === "1");
  }, []);

  if (installed || dismissed || (!canPrompt && !ios)) return null;
  const close = () => {
    localStorage.setItem(INSTALL_HINT_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 lg:right-6 lg:bottom-6 lg:left-auto">
      <Card className="animate-fade-up pointer-events-auto w-full max-w-sm shadow-overlay" variant="secondary">
        <CloseButton aria-label="Hinweis schließen" className="absolute top-3 right-3" onPress={close} />
        <Card.Header className="flex-row items-center gap-3 pe-10">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Download className="size-5" aria-hidden="true" />
          </div>
          <div>
            <Card.Title>App installieren</Card.Title>
            <Card.Description>Schneller Start, Vollbild und offline nutzbar.</Card.Description>
          </div>
        </Card.Header>
        <Card.Footer>
          {canPrompt ? (
            <Button
              fullWidth
              onPress={async () => {
                if (await install()) close();
              }}
            >
              Jetzt installieren
            </Button>
          ) : (
            <p className="text-sm text-muted">
              Tippe unten auf <Share className="inline size-4 align-text-bottom" aria-label="Teilen" /> und dann auf
              „Zum Home-Bildschirm“.
            </p>
          )}
        </Card.Footer>
      </Card>
    </div>
  );
}

/** Optionale App-Sperre: nach X Minuten Inaktivität automatisch abmelden. */
function InactivityLock() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const minutes = () => Number(localStorage.getItem(LOCK_KEY) ?? 0);
    const lock = () => signOut(false);
    const check = () => {
      const m = minutes();
      if (!m) return;
      const last = Number(localStorage.getItem(ACTIVITY_KEY) ?? Date.now());
      if (Date.now() - last > m * 60_000) void lock();
    };
    const bump = () => {
      const m = minutes();
      if (!m) return;
      localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void lock(), m * 60_000);
    };
    check();
    bump();
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    let throttle = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - throttle > 5_000) {
        throttle = now;
        bump();
      }
    };
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    const onVisible = () => (document.visibilityState === "visible" ? check() : undefined);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
