"use client";

import { useEffect, useState } from "react";

/** Server-Daten zusätzlich lokal merken (z. B. Kategorien für Offline-Erfassung). */
export function useCachedValue<T>(key: string, serverValue: T | undefined, fallback: T): T {
  const [value, setValue] = useState<T>(serverValue ?? fallback);
  useEffect(() => {
    if (serverValue !== undefined) {
      setValue(serverValue);
      try {
        localStorage.setItem(key, JSON.stringify(serverValue));
      } catch {}
    } else {
      try {
        const raw = localStorage.getItem(key);
        if (raw) setValue(JSON.parse(raw) as T);
      } catch {}
    }
  }, [key, serverValue]);
  return value;
}
