import type { Db } from "mongodb";

export type Migration = {
  /** Fortlaufend und sortierbar, z. B. "001-user-settings". */
  id: string;
  description: string;
  /**
   * Muss idempotent sein und darf nur ergaenzen, nie loeschen. Bei
   * `dryRun` wird nichts geschrieben, nur gezaehlt.
   */
  up: (db: Db, options: { dryRun: boolean }) => Promise<string>;
};

type MigrationRecord = { _id: string; description: string; appliedAt: Date; summary: string };

export async function runMigrations(
  db: Db,
  list: Migration[],
  options: { dryRun: boolean; beforeApply?: () => Promise<void> },
) {
  const ids = list.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) throw new Error("Doppelte Migrations-ID");

  const log = db.collection<MigrationRecord>("migrations");
  const done = new Set((await log.find({}, { projection: { _id: 1 } }).toArray()).map((row) => row._id));
  const pending = [...list].sort((a, b) => a.id.localeCompare(b.id)).filter((entry) => !done.has(entry.id));

  if (pending.length > 0 && !options.dryRun) await options.beforeApply?.();

  const results: Array<{ id: string; description: string; summary: string }> = [];

  for (const migration of pending) {
    const summary = await migration.up(db, { dryRun: options.dryRun });
    if (!options.dryRun) {
      await log.insertOne({
        _id: migration.id,
        description: migration.description,
        appliedAt: new Date(),
        summary,
      });
    }
    results.push({ id: migration.id, description: migration.description, summary });
  }

  return results;
}
