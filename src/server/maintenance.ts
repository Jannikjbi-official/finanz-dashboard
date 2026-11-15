import "server-only";
import { eq, lt, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/lib/db";
import { appSetting, loginHandoff, rateLimit, session, verification } from "@/lib/db/schema";

const KEY = "lastCleanup";
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Hält die Datenbank klein (Neon Free: 1 GB pro Projekt): höchstens einmal pro Tag
 * abgelaufene Sessions, OAuth-States, Login-Übergaben und alte
 * Rate-Limit-Einträge löschen. Finanzdaten werden nie angefasst.
 */
async function cleanup(): Promise<void> {
  const [row] = await db.select().from(appSetting).where(eq(appSetting.key, KEY)).limit(1);
  const last = typeof row?.value === "number" ? row.value : 0;
  const now = Date.now();
  if (now - last < DAY_MS) return;

  // Zuerst den Zeitstempel setzen, damit parallele Requests nicht doppelt aufräumen
  await db
    .insert(appSetting)
    .values({ key: KEY, value: now })
    .onConflictDoUpdate({ target: appSetting.key, set: { value: now, updatedAt: new Date() } });

  const nowDate = new Date(now);
  await Promise.all([
    db.delete(session).where(lt(session.expiresAt, nowDate)),
    db.delete(verification).where(lt(verification.expiresAt, nowDate)),
    db.delete(loginHandoff).where(lt(loginHandoff.expiresAt, nowDate)),
    db.delete(rateLimit).where(lt(rateLimit.lastRequest, now - DAY_MS)),
  ]);
}

/** Einmal pro Request aufrufbar, läuft aber nur einmal am Tag. Fehler blockieren nie die Seite. */
export const ensureMaintenance = cache(async () => {
  try {
    await cleanup();
  } catch (error) {
    console.error("Aufräumen fehlgeschlagen", error);
  }
});

/** Für die Einstellungen: aktuelle Datenbankgröße in Bytes. */
export async function databaseSizeBytes(): Promise<number | null> {
  try {
    const [r] = await db.execute<{ size: string }>(sql`select pg_database_size(current_database())::text as size`).then(
      (res) => res.rows,
    );
    return r ? Number(r.size) : null;
  } catch {
    return null;
  }
}
