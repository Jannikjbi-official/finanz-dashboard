/**
 * Schaltet Adressen fuer die Closed Beta frei.
 *
 *   npm run beta:invite -- a@example.org b@example.org
 *   npm run beta:invite -- --list
 *   npm run beta:invite -- --remove a@example.org
 */
import { closeScriptDb, openScriptDb } from "./lib/db";

type Invite = { _id: string; invitedAt: Date; note: string | null };

const args = process.argv.slice(2);
const emails = args.filter((arg) => !arg.startsWith("--")).map((arg) => arg.trim().toLowerCase());

const { client, db } = await openScriptDb();
const invites = db.collection<Invite>("beta_invites");

try {
  if (args.includes("--list")) {
    for (const invite of await invites.find({}).sort({ invitedAt: 1 }).toArray()) {
      console.log(`${invite.invitedAt.toISOString().slice(0, 10)}  ${invite._id}`);
    }
  } else if (args.includes("--remove")) {
    const { deletedCount } = await invites.deleteMany({ _id: { $in: emails } });
    console.log(`${deletedCount} Einladung(en) entfernt`);
  } else {
    if (emails.length === 0) throw new Error("Mindestens eine E-Mail-Adresse angeben");
    for (const email of emails) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        console.log(`übersprungen (ungültig): ${email}`);
        continue;
      }
      await invites.updateOne(
        { _id: email },
        { $setOnInsert: { invitedAt: new Date(), note: null } },
        { upsert: true },
      );
      console.log(`freigeschaltet: ${email}`);
    }
  }
} finally {
  await closeScriptDb(client);
}
