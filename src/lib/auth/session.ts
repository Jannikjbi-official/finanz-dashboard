import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./index";
import { isAllowedEmail } from "./config";

/** Aktuelle Session (pro Request gecacht) – nur wenn der Nutzer erlaubt ist. */
export const getSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAllowedEmail(session.user.email)) return null;
  return session;
});

/** Für Seiten: ohne Session → Login. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Nicht angemeldet");
  }
}

/** Für Server Actions & API-Routen: wirft ohne gültige Session. */
export async function assertSession() {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}
