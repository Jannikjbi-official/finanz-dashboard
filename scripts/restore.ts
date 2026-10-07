/**
 * Spielt eine Sicherung aus backups/ zurueck.
 *
 *   npm run db:restore -- backups/<ordner>             nur in leere Collections
 *   npm run db:restore -- backups/<ordner> --replace   vorhandene Daten ersetzen
 *
 * Mit --replace wird vorher automatisch eine neue Sicherung des aktuellen
 * Stands angelegt - ein Restore ist damit selbst wieder umkehrbar.
 */
import { backupDatabase, readBackup } from "./lib/backup";
import { closeScriptDb, openScriptDb } from "./lib/db";

const args = process.argv.slice(2);
const dir = args.find((arg) => !arg.startsWith("--"));
const replace = args.includes("--replace");

if (!dir) {
  console.error("Ordner der Sicherung angeben, z. B. backups/2026-10-07T...-manual");
  process.exit(1);
}

const { client, db, label } = await openScriptDb();

try {
  const data = await readBackup(dir);
  console.log(`Ziel: ${label}`);

  if (!replace) {
    for (const name of Object.keys(data)) {
      const existing = await db.collection(name).estimatedDocumentCount();
      if (existing > 0) {
        throw new Error(
          `Collection "${name}" ist nicht leer (${existing}). Abbruch – mit --replace ersetzen.`,
        );
      }
    }
  } else {
    const safety = await backupDatabase(db, "before-restore");
    console.log(`Aktueller Stand gesichert: ${safety.dir}`);
  }

  for (const [name, docs] of Object.entries(data)) {
    const collection = db.collection(name);
    if (replace) await collection.deleteMany({});
    if (docs.length > 0) await collection.insertMany(docs);
    console.log(`  ${name.padEnd(24)} ${docs.length}`);
  }

  console.log("Wiederhergestellt.");
} finally {
  await closeScriptDb(client);
}
