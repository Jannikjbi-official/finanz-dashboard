import "server-only";
import { findRecurringMatches } from "../domain/matching";
import { followingDue, reopenDue } from "../domain/recurring";
import type { Recurring } from "../domain/types";
import { toRecurring } from "./convert";
import { loadFinanceData } from "./data";
import { recurring, toObjectId, transactions } from "./db";

/**
 * Eine vorhandene Buchung einem offenen Termin zuordnen: Der Termin gilt
 * als erledigt (nextDue rueckt weiter), die Buchung traegt recurringId und
 * recurringDue. Es entsteht keine zusaetzliche Buchung.
 *
 * Nur der naechste offene Termin ist erlaubt, und beide Aenderungen sind an
 * den erwarteten Zustand gebunden - doppelte Klicks ordnen nichts doppelt zu.
 */
export async function linkPayment(userId: string, entry: Recurring, due: string, transactionId: string) {
  const recurringObjectId = toObjectId(entry.id);
  const txObjectId = toObjectId(transactionId);
  if (!recurringObjectId || !txObjectId || due !== entry.nextDue) return false;

  const next = followingDue(entry, due);
  const moved = await recurring.updateOne(
    { _id: recurringObjectId, userId, nextDue: due },
    { $set: { nextDue: next, updatedAt: new Date() } },
  );
  if (moved.modifiedCount === 0) return false;

  const linked = await transactions.updateOne(
    {
      _id: txObjectId,
      userId,
      status: "booked",
      type: entry.type,
      recurringId: { $in: [null] },
      transferGroupId: { $in: [null] },
    },
    { $set: { recurringId: entry.id, recurringDue: due, updatedAt: new Date() } },
  );
  if (linked.modifiedCount === 0) {
    await recurring.updateOne({ _id: recurringObjectId, userId, nextDue: next }, { $set: { nextDue: due } });
    return false;
  }
  return true;
}

/**
 * Sichere Treffer der Reihe nach zuordnen (nach dem Import und per Knopf).
 * Bewusst keine Server Action: die userId kommt immer aus der Sitzung.
 */
export async function linkSureMatches(userId: string): Promise<number> {
  const data = await loadFinanceData(userId);
  const byId = new Map(data.recurring.map((entry) => [entry.id, entry]));
  let linked = 0;
  for (const match of findRecurringMatches(data.recurring, data.transactions, data.today)) {
    if (match.confidence !== "sure") continue;
    const entry = byId.get(match.recurringId)!;
    if (!(await linkPayment(userId, entry, match.due, match.transaction.id))) continue;
    linked += 1;
    // Der naechste Termin desselben Eintrags baut auf dem neuen nextDue auf
    const fresh = await recurring.findOne({ _id: toObjectId(entry.id)!, userId });
    if (fresh) byId.set(entry.id, toRecurring(fresh));
  }
  return linked;
}

/**
 * Vor dem Loeschen zugeordneter Buchungen (Import rueckgaengig): Termine,
 * die sie erledigt haben, wieder oeffnen - vom letzten aus rueckwaerts, nur
 * solange keine Luecke entsteht. Sonst waeren sie weder bezahlt noch offen.
 */
export async function reopenLinkedDues(userId: string, docs: Array<{ recurringId?: string | null; recurringDue?: string | null }>) {
  const byEntry = new Map<string, string[]>();
  for (const doc of docs) {
    if (doc.recurringId && doc.recurringDue) byEntry.set(doc.recurringId, [...(byEntry.get(doc.recurringId) ?? []), doc.recurringDue]);
  }
  for (const [id, dues] of byEntry) {
    const _id = toObjectId(id);
    const doc = _id ? await recurring.findOne({ _id, userId }) : null;
    if (!doc) continue;
    let entry = toRecurring(doc);
    for (const due of dues.sort().reverse()) {
      const reopened = reopenDue(entry, due);
      if (!reopened) break;
      entry = { ...entry, nextDue: reopened };
    }
    if (entry.nextDue !== doc.nextDue) {
      await recurring.updateOne({ _id: doc._id, userId, nextDue: doc.nextDue }, { $set: { nextDue: entry.nextDue, updatedAt: new Date() } });
    }
  }
}

/**
 * Einen Termin als bezahlt/eingegangen buchen: nextDue rueckt atomar weiter
 * (an den erwarteten Termin gebunden), dann entsteht genau eine Buchung.
 * Scheitert die Buchung, wird der Termin wieder geoeffnet. Genutzt von
 * "Bezahlt"/"Eingegangen" und vom automatischen Buchen.
 */
export async function bookDue(
  userId: string,
  entry: Recurring,
  due: string,
  options: { amountCents: number; date: string; accountId: string },
): Promise<boolean> {
  const _id = toObjectId(entry.id);
  if (!_id || due !== entry.nextDue) return false;
  const next = followingDue(entry, due);
  const moved = await recurring.updateOne({ _id, userId, nextDue: due }, { $set: { nextDue: next, updatedAt: new Date() } });
  if (moved.modifiedCount === 0) return false;
  try {
    await transactions.insertOne({
      userId,
      type: entry.type,
      status: "booked",
      amountCents: options.amountCents,
      date: options.date,
      title: entry.title,
      note: null,
      categoryId: entry.categoryId,
      accountId: options.accountId,
      transferGroupId: null,
      recurringId: entry.id,
      recurringDue: due,
      createdAt: new Date(),
    });
  } catch (error) {
    await recurring.updateOne({ _id, userId, nextDue: next }, { $set: { nextDue: due } });
    throw error;
  }
  return true;
}
