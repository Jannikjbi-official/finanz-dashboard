import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pool?: Pool };

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL fehlt – siehe README (Neon verbinden).");
  }
  const pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 5_000 });
  // Auf Vercel (Fluid Compute) werden Leerlauf-Verbindungen sauber geschlossen.
  attachDatabasePool(pool);
  return pool;
}

const pool = globalForDb.pool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle({ client: pool, schema, casing: "snake_case" });
export type Db = typeof db;
export { schema };
