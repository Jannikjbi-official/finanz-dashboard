import { MongoClient } from "mongodb";

/** Verbindung fuer Kommandozeilen-Skripte. Liest dieselben Variablen wie die App. */
export async function openScriptDb() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB ?? "finanz";

  if (!uri) {
    throw new Error("MONGODB_URI fehlt (wird aus .env gelesen)");
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();

  // Zugangsdaten nie ausgeben, nur Host und Datenbank
  const host = uri.replace(/^mongodb(\+srv)?:\/\/([^@]*@)?/, "").split(/[/?]/)[0];
  return { client, db: client.db(dbName), label: `${host}/${dbName}` };
}

export async function closeScriptDb(client: MongoClient) {
  await client.close();
}
