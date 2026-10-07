"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";

type Toast = { id: number; text: string; tone: "ok" | "error" };

const ToastContext = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

/** Kurze Rueckmeldung nach dem Speichern, unten mittig, verschwindet selbst. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const push = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = next.current++;
    setToasts((list) => [...list.slice(-2), { id, text, tone }]);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDone={() => setToasts((list) => list.filter((t) => t.id !== toast.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, toast.tone === "error" ? 6000 : 3200);
    return () => clearTimeout(timer);
  }, [onDone, toast.tone]);

  const Icon = toast.tone === "ok" ? CheckCircle : WarningCircle;

  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      className="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-sm bg-ink px-3.5 py-2.5 text-[14px] text-paper shadow-float animate-[toast-in_180ms_ease-out]"
    >
      <Icon size={17} weight="fill" className={toast.tone === "ok" ? "text-[var(--pos-soft)]" : "text-[var(--neg-soft)]"} />
      {toast.text}
    </div>
  );
}
