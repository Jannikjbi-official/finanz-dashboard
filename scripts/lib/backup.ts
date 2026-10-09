import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { BSON, type Db, type Document } from "mongodb";

const ROOT = path.resolve(process.cwd(), "backups");

export async function backupDatabase(db: Db, reason = "manual") {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(ROOT, `${stamp}-${reason}`);
  await mkdir(dir, { recursive: true });

  const collections = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith("system."))
    .sort();

  const counts: Record<string, number> = {};

  for (const name of collections) {
    const docs = await db.collection(name).find({}).toArray();
    counts[name] = docs.length;
    await writeFile(
      path.join(dir, `${name}.json`),
      BSON.EJSON.stringify(docs, undefined, 0, { relaxed: false }),
      "utf8",
    );
  }

  await writeFile(
    path.join(dir, "manifest.json"),
    JSON.stringify({ createdAt: new Date().toISOString(), database: db.databaseName, reason, counts }, null, 2),
    "utf8",
  );

  return { dir, counts };
}

export async function readBackup(dir: string) {
  const files = (await readdir(dir)).filter(
    (file) => file.endsWith(".json") && file !== "manifest.json",
  );

  const result: Record<string, Document[]> = {};
  for (const file of files) {
    const text = await readFile(path.join(dir, file), "utf8");
    result[file.replace(/\.json$/, "")] = BSON.EJSON.parse(text, { relaxed: false }) as Document[];
  }
  return result;
}
