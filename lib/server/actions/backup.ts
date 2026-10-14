"use server";

import { parseBackup, restoreBackup, restoreSnapshot } from "../restore";
import { authorize, fail, ok, refresh, type ActionResult } from "./shared";

/** Hoechstens so viele Zeichen (die Server Action nimmt 4 MB). */
const MAX_TEXT = 3_900_000;

function summary(counts: Record<string, number>) {
  const parts = [
    counts.accounts !== undefined && `${counts.accounts} Konten`,
    counts.transactions !== undefined && `${counts.transactions} Buchungen`,
    counts.recurring !== undefined && `${counts.recurring} regelmäßige Zahlungen`,
    counts.wishes !== undefined && `${counts.wishes} Wünsche`,
  ].filter(Boolean);
  return parts.join(", ");
}

/** JSON-Sicherung einspielen; ersetzt alle eigenen Daten (vorher automatisch gesichert). */
export async function restoreFromBackup(text: string): Promise<ActionResult> {
  const auth = await authorize("import");
  if ("error" in auth) return auth.error;
  if (typeof text !== "string" || text.length === 0) return fail("Bitte eine Sicherungsdatei wählen.");
  if (text.length > MAX_TEXT) return fail("Die Datei ist zu groß (höchstens 4 MB).");

  const parsed = parseBackup(text, auth.userId);
  if (!parsed.ok) return fail(parsed.error);
  const result = await restoreBackup(auth.userId, parsed.data);
  if (!result.ok) return fail(result.error);
  refresh();
  return ok(`Sicherung eingespielt: ${summary(result.counts)}`);
}

/** Den Stand vor einer Wiederherstellung zurueckholen. */
export async function restorePreviousState(snapshotId: string): Promise<ActionResult> {
  const auth = await authorize("import");
  if ("error" in auth) return auth.error;
  if (typeof snapshotId !== "string") return fail("Sicherung nicht gefunden");
  const result = await restoreSnapshot(auth.userId, snapshotId);
  if (!result.ok) return fail(result.error);
  refresh();
  return ok(`Früherer Stand zurückgeholt: ${summary(result.counts)}`);
}
