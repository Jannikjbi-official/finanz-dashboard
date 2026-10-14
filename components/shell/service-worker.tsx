"use client";

import { useEffect } from "react";

/** Service Worker registrieren (nur in Produktion, siehe public/sw.js). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
