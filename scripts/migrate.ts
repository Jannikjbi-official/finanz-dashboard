/**
 * Wendet alle Drizzle-Migrationen aus ./drizzle an.
 * Läuft lokal per `npm run db:migrate` und auf Vercel automatisch beim Build.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    if (process.env.VERCEL) {
      throw new Error("DATABASE_URL fehlt – Neon-Integration mit dem Vercel-Projekt verbinden.");
    }
    console.warn("DATABASE_URL fehlt – Migration übersprungen.");
    return;
  }
  // Für Migrationen die direkte (nicht gepoolte) Verbindung bevorzugen.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || url, max: 1 });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: "./drizzle" });
    console.log("✔ Migrationen angewendet");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
