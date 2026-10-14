import "server-only";
import { todayIn } from "../domain/calendar";
import { toRecurring } from "./convert";
import { recurring, toObjectId } from "./db";
import { bookDue, linkSureMatches } from "./recurring-link";
import { getSettings } from "./user-data";

/**
 * Automatisches Buchen (taeglich per Vercel Cron, siehe vercel.json).
 *
 * Nur Eintraege mit autoBook, Status aktiv und Konto. Pro Nutzer werden
 * zuerst sichere Treffer zugeordnet - kam die Zahlung schon per Import,
 * wird sie so nicht doppelt gebucht. Danach wird jeder faellige Termin bis
 * heute (in der Zeitzone des Nutzers) einzeln gebucht; die Buchung ist an
 * den erwarteten Termin gebunden, ein zweiter Lauf bucht nichts doppelt.
 */
export async function runAutoBooking(): Promise<{ users: number; linked: number; booked: number }> {
  const userIds = await recurring.distinct("userId", { autoBook: true, status: "active", accountId: { $type: "string" } });
  let linked = 0;
  let booked = 0;

  for (const userId of userIds) {
    const today = todayIn((await getSettings(userId)).timeZone);
    linked += await linkSureMatches(userId);

    const docs = await recurring.find({ userId, autoBook: true, status: "active", accountId: { $type: "string" }, nextDue: { $lte: today } }).toArray();
    for (const doc of docs) {
      let entry = toRecurring(doc);
      // Hoechstens ein Jahr nachholen - aeltere Luecken bleiben sichtbar offen
      for (let step = 0; step < 12 && entry.nextDue <= today; step += 1) {
        if (entry.endDate && entry.nextDue > entry.endDate) break;
        const ok = await bookDue(userId, entry, entry.nextDue, { amountCents: entry.amountCents, date: entry.nextDue, accountId: entry.accountId! });
        if (!ok) break;
        booked += 1;
        const fresh = await recurring.findOne({ _id: toObjectId(entry.id)!, userId });
        if (!fresh) break;
        entry = toRecurring(fresh);
      }
    }
  }
  return { users: userIds.length, linked, booked };
}
