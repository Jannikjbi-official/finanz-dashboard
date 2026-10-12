"use server";

import { headers } from "next/headers";
import { auth } from "../auth";
import { getCurrentUser } from "../session";
import { fail, ok, refresh, type ActionResult } from "./shared";

/**
 * Eine bestimmte Sitzung beenden. Der Browser kennt nur die ID; das Token
 * wird hier auf dem Server aus den eigenen Sitzungen nachgeschlagen.
 */
export async function revokeSessionById(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.");
  const requestHeaders = await headers();
  const sessions = await auth.api.listSessions({ headers: requestHeaders });
  const target = sessions.find((session) => String(session.id) === id);
  if (!target) return fail("Sitzung nicht gefunden");
  await auth.api.revokeSession({ headers: requestHeaders, body: { token: target.token } });
  refresh();
  return ok("Sitzung beendet");
}

/** Alle Sitzungen ausser der aktuellen beenden. */
export async function revokeOtherSessionsAction(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.");
  await auth.api.revokeOtherSessions({ headers: await headers() });
  refresh();
  return ok("Alle anderen Sitzungen wurden beendet");
}
