"use server";

import { z } from "zod";
import { addDays } from "../../domain/calendar";
import { scoreMatch } from "../../domain/matching";
import { reopenDue } from "../../domain/recurring";
import { toRecurring, toTransaction } from "../convert";
import { recurring, toObjectId, transactions } from "../db";
import { linkPayment, linkSureMatches } from "../recurring-link";
import { authorize, fail, firstIssue, isoDate, ok, refresh, type ActionResult } from "./shared";

/**
 * Regelmaessige Zahlungen mit vorhandenen Buchungen abgleichen (siehe
 * lib/domain/matching.ts): Vorschlag annehmen, ablehnen, von Hand
 * verknuepfen oder eine Zuordnung wieder loesen.
 */

const linkSchema = z.object({ recurringId: z.string(), due: isoDate, transactionId: z.string() });
export type LinkInput = z.input<typeof linkSchema>;

async function findEntry(userId: string, id: string) {
  const _id = toObjectId(id);
  const doc = _id ? await recurring.findOne({ _id, userId }) : null;
  return doc ? toRecurring(doc) : null;
}

export async function linkRecurringPayment(input: LinkInput): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { recurringId, due, transactionId } = parsed.data;

  const entry = await findEntry(auth.userId, recurringId);
  if (!entry) return fail("Eintrag nicht gefunden");
  if (due !== entry.nextDue) return fail("Dieser Termin ist schon erledigt. Die Ansicht wird aktualisiert.");
  if (!(await linkPayment(auth.userId, entry, due, transactionId))) {
    return fail("Die Buchung passt nicht (mehr) zu diesem Termin. Die Ansicht wird aktualisiert.");
  }
  refresh();
  return ok(entry.type === "income" ? "Zugeordnet – zählt nicht mehr als erwartet" : "Zugeordnet – zählt nicht mehr als offen");
}

/** Alle sicheren Treffer auf einmal zuordnen. */
export async function linkAllSureMatches(): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const linked = await linkSureMatches(auth.userId);
  refresh();
  return linked > 0 ? ok(`${linked} Zahlungen zugeordnet`) : fail("Keine sicheren Treffer gefunden");
}

/** Vorschlag ablehnen: diese Buchung wird fuer diesen Eintrag nicht mehr vorgeschlagen. */
export async function dismissRecurringMatch(input: { recurringId: string; transactionId: string }): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const _id = toObjectId(input?.transactionId);
  if (!_id || typeof input.recurringId !== "string" || !toObjectId(input.recurringId)) return fail("Buchung nicht gefunden");
  await transactions.updateOne({ _id, userId: auth.userId }, { $addToSet: { dismissedRecurring: input.recurringId } });
  refresh();
  return ok("Wird nicht mehr vorgeschlagen");
}

/** Zuordnung loesen: Buchung bleibt, der Termin ist wieder offen (wenn er der letzte erledigte war). */
export async function unlinkRecurringPayment(transactionId: string): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const _id = toObjectId(transactionId);
  const doc = _id ? await transactions.findOne({ _id, userId: auth.userId }) : null;
  if (!doc || !doc.recurringId || !doc.recurringDue) return fail("Buchung ist keiner regelmäßigen Zahlung zugeordnet");

  const entry = await findEntry(auth.userId, doc.recurringId);
  if (entry) {
    const reopened = reopenDue(entry, doc.recurringDue);
    if (!reopened) return fail("Erst die späteren Zahlungen dieses Eintrags lösen – sonst entstünde eine Lücke.");
    await recurring.updateOne({ _id: toObjectId(entry.id)!, userId: auth.userId, nextDue: entry.nextDue }, { $set: { nextDue: reopened, updatedAt: new Date() } });
  }
  await transactions.updateOne(
    { _id: doc._id, userId: auth.userId },
    { $set: { recurringId: null, recurringDue: null, updatedAt: new Date() }, $addToSet: { dismissedRecurring: doc.recurringId } },
  );
  refresh();
  return ok("Zuordnung gelöst – der Termin ist wieder offen");
}

export type LinkCandidate = { id: string; date: string; title: string; amountCents: number; likely: boolean };

/** Buchungen, die von Hand mit einem Termin verknuepft werden koennen (± 20 Tage). */
export async function findLinkCandidates(recurringId: string, due: string): Promise<LinkCandidate[]> {
  const auth = await authorize();
  if ("error" in auth) return [];
  const entry = await findEntry(auth.userId, recurringId);
  if (!entry || !isoDate.safeParse(due).success) return [];

  const docs = await transactions
    .find({
      userId: auth.userId,
      type: entry.type,
      status: "booked",
      recurringId: { $in: [null] },
      transferGroupId: { $in: [null] },
      date: { $gte: addDays(due, -20), $lte: addDays(due, 20) },
    })
    .limit(200)
    .toArray();
  return docs
    .map((doc) => {
      const tx = toTransaction(doc);
      return { id: tx.id, date: tx.date, title: tx.title, amountCents: tx.amountCents, likely: scoreMatch(entry, due, { ...tx, dismissedRecurring: [] }) !== null };
    })
    .sort((a, b) => Number(b.likely) - Number(a.likely) || Math.abs(a.amountCents - entry.amountCents) - Math.abs(b.amountCents - entry.amountCents));
}

/**
 * Betragsaenderung uebernehmen oder bewusst beibehalten. Der neue Betrag
 * wird auf dem Server aus der zuletzt zugeordneten Zahlung bestimmt.
 */
export async function resolveAmountChange(input: { recurringId: string; accept: boolean }): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const entry = typeof input?.recurringId === "string" ? await findEntry(auth.userId, input.recurringId) : null;
  if (!entry) return fail("Eintrag nicht gefunden");
  const latestDoc = await transactions
    .find({ userId: auth.userId, recurringId: entry.id, status: "booked", recurringDue: { $type: "string" } })
    .sort({ recurringDue: -1 })
    .limit(1)
    .toArray();
  const latest = latestDoc[0]?.amountCents;
  if (latest === undefined || latest === entry.amountCents) return fail("Keine Betragsänderung gefunden");

  const set = input.accept ? { amountCents: latest, amountCheckedCents: null } : { amountCheckedCents: latest };
  await recurring.updateOne({ _id: toObjectId(entry.id)!, userId: auth.userId }, { $set: { ...set, updatedAt: new Date() } });
  refresh();
  return ok(input.accept ? `Betrag auf ${(latest / 100).toFixed(2).replace(".", ",")} € geändert` : "Betrag bleibt unverändert");
}
