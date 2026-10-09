/**
 * Sichert alle Collections der Datenbank als Extended JSON.
 *
 *   npm run db:backup
 *
 * Ergebnis: backups/<Zeitstempel>/<collection>.json + manifest.json.
 * Extended JSON erhaelt ObjectIds und Datumswerte exakt, damit sich die
 * Sicherung 1:1 zurueckspielen laesst (npm run db:restore).
 */
import { backupDatabase } from "./lib/backup";
import { closeScriptDb, openScriptDb } from "./lib/db";

const { client, db, label } = await openScriptDb();

try {
  const { dir, counts } = await backupDatabase(db);
  console.log(`Datenbank: ${label}`);
  for (const [name, count] of Object.entries(counts)) {
    console.log(`  ${name.padEnd(24)} ${count}`);
  }
  console.log(`Sicherung liegt in ${dir}`);
} finally {
  await closeScriptDb(client);
}
