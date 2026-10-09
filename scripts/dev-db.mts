/**
 * Lokale MongoDB fuer die Entwicklung - ohne Installation.
 *
 *   npm run dev:db
 *
 * Laeuft auf 127.0.0.1:27017 und speichert in .devdb/, Daten bleiben also
 * zwischen Neustarts erhalten. Beenden mit Strg+C.
 */
import { mkdir } from "node:fs/promises";
import { MongoMemoryServer } from "mongodb-memory-server";

const dbPath = ".devdb";
await mkdir(dbPath, { recursive: true });

const server = await MongoMemoryServer.create({
  instance: { port: 27017, ip: "127.0.0.1", dbPath, storageEngine: "wiredTiger" },
});

console.log(`MongoDB läuft: ${server.getUri()} (Daten in ${dbPath}/)`);

async function stop() {
  await server.stop({ doCleanup: false });
  process.exit(0);
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
