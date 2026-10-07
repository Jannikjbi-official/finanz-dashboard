/**
 * Warteliste verwalten.
 *
 *   npm run waitlist                      alle Eintraege anzeigen
 *   npm run waitlist -- --invite a@b.de   freischalten (wandert zu beta_invites)
 *   npm run waitlist -- --remove a@b.de   Eintrag loeschen (z. B. auf Wunsch)
 */
import { closeScriptDb, openScriptDb } from "./lib/db";

type Entry = { _id: string; name: string | null; consentAt: Date; createdAt: Date };

const args = process.argv.slice(2);
const emails = args.filter((arg) => !arg.startsWith("--")).map((arg) => arg.trim().toLowerCase());

const { client, db } = await openScriptDb();
const list = db.collection<Entry>("waitlist");
const invites = db.collection<{ _id: string; invitedAt: Date; note: string | null }>("beta_invites");

try {
  if (args.includes("--invite")) {
    for (const email of emails) {
      const entry = await list.findOne({ _id: email });
      await invites.updateOne({ _id: email }, { $setOnInsert: { invitedAt: new Date(), note: "von der Warteliste" } }, { upsert: true });
      await list.deleteOne({ _id: email });
      console.log(`${entry ? "freigeschaltet" : "freigeschaltet (stand nicht auf der Liste)"}: ${email}`);
    }
    console.log("Einladungslink: <deine Domain>/registrieren?einladung");
  } else if (args.includes("--remove")) {
    const { deletedCount } = await list.deleteMany({ _id: { $in: emails } });
    console.log(`${deletedCount} Eintrag/Einträge gelöscht`);
  } else {
    const entries = await list.find({}).sort({ createdAt: 1 }).toArray();
    for (const entry of entries) {
      console.log(`${entry.createdAt.toISOString().slice(0, 10)}  ${entry._id}${entry.name ? `  (${entry.name})` : ""}`);
    }
    console.log(`${entries.length} auf der Warteliste`);
  }
} finally {
  await closeScriptDb(client);
}
