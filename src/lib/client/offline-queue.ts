"use client";

/**
 * Warteschlange für offline erfasste Einträge (localStorage).
 * Jeder Eintrag trägt eine clientId → der Server legt ihn genau einmal an.
 */
const KEY = "finanzen-offline-queue";
const EVENT = "finanzen:queue-changed";

export interface QueueItem {
  type: "expense" | "income";
  payload: Record<string, unknown> & { clientId: string };
  queuedAt: number;
}

export function readQueue(): QueueItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as QueueItem[];
  } catch {
    return [];
  }
}

function writeQueue(items: QueueItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: items.length }));
}

export function enqueue(item: Omit<QueueItem, "queuedAt">) {
  writeQueue([...readQueue(), { ...item, queuedAt: Date.now() }]);
}

export function onQueueChange(cb: (count: number) => void) {
  const handler = (e: Event) => cb((e as CustomEvent<number>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

let syncing = false;

/** Sendet die Warteschlange an den Server. Gibt die Zahl gespeicherter Einträge zurück. */
export async function flushQueue(): Promise<number> {
  if (syncing || !navigator.onLine) return 0;
  const items = readQueue();
  if (items.length === 0) return 0;
  syncing = true;
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: items.map(({ type, payload }) => ({ type, payload })) }),
    });
    if (!res.ok) return 0;
    const { results } = (await res.json()) as { results: { ok: boolean }[] };
    // Nur fehlgeschlagene behalten (Validierungsfehler werden verworfen, um Endlosschleifen zu vermeiden)
    const sent = new Set(items.map((i) => i.payload.clientId));
    writeQueue(readQueue().filter((i) => !sent.has(i.payload.clientId)));
    return results.filter((r) => r.ok).length;
  } catch {
    return 0;
  } finally {
    syncing = false;
  }
}

/** Heuristik: ist der Fehler ein Netzwerkfehler? */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = error instanceof Error ? error.message : String(error);
  return /fetch|network|Load failed|Failed to fetch|NetworkError/i.test(msg);
}
