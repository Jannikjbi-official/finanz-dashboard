"use client";

import { authClient } from "@/lib/auth/client";

/** Abmelden – optional auf allen Geräten (alle Sessions widerrufen). */
export async function signOut(allDevices = false) {
  try {
    if (allDevices) await authClient.revokeSessions();
    await authClient.signOut();
  } finally {
    try {
      localStorage.removeItem("finanzen-login-handoff");
      localStorage.removeItem("finanzen-last-activity");
      navigator.serviceWorker?.controller?.postMessage("clear-pages");
    } catch {}
    window.location.replace("/login");
  }
}
