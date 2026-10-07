/**
 * Fuehrt ausstehende Datenmigrationen aus.
 *
 *   npm run db:migrate -- --dry-run   nur anzeigen, was passieren wuerde
 *   npm run db:migrate                sichern, dann ausfuehren
 *
 * Erledigte Migrationen stehen in der Collection "migrations" und laufen nie
 * doppelt. Vor jedem echten Lauf wird automatisch gesichert.
 */
import { migrations } from "../lib/server/migrations";
import { runMigrations } from "../lib/server/migrations/runner";
import { backupDatabase } from "./lib/backup";
import { closeScriptDb, openScriptDb } from "./lib/db";

const dryRun = process.argv.includes("--dry-run");
const { client, db, label } = await openScriptDb();

try {
  console.log(`Datenbank: ${label}${dryRun ? " (Probelauf)" : ""}`);

  const results = await runMigrations(db, migrations, {
    dryRun,
    beforeApply: async () => {
      const { dir } = await backupDatabase(db, "before-migrate");
      console.log(`Gesichert: ${dir}`);
    },
  });

  if (results.length === 0) console.log("Nichts zu tun.");
  for (const result of results) {
    console.log(`  ${result.id}  ${result.description}`);
    console.log(`      ${result.summary}`);
  }
} finally {
  await closeScriptDb(client);
}
