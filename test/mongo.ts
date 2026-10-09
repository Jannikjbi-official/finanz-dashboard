import { MongoMemoryServer } from "mongodb-memory-server";

/**
 * Startet eine echte MongoDB im Speicher und setzt die Umgebungsvariablen,
 * bevor die App-Module importiert werden (lib/mongo.ts liest sie beim Laden).
 */
export async function startTestMongo(dbName = "test") {
  const server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri();
  process.env.MONGODB_DB = dbName;

  return {
    server,
    async stop() {
      const { client } = await import("@/lib/mongo");
      await client.close();
      await server.stop();
    },
  };
}
