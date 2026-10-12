import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import type { Migration } from "./runner";
import type { LegacyPlannedDoc, RecurringDoc, SettingsDoc, TransactionDoc } from "../db";
import { inferCostType } from "../../domain/labels";

type PlannedDoc = LegacyPlannedDoc & { certainty?: string; transactionId?: string | null; legacyRefundId?: string | null };
type UserSettingsDoc = SettingsDoc;
type RefundDoc = {
  userId: string;
  title: string;
  amountCents: number;
  expectedFrom: string | null;
  expectedTo: string | null;
  status: "open" | "received";
  receivedDate: string | null;
  categoryId: string | null;
  accountId: string | null;
  note: string | null;
  createdAt: Date;
};
import { addDays, daysBetween } from "../../domain/calendar";
import { firstOccurrenceFrom, occurrencesBetween } from "../../domain/schedule";

/**
 * Alle Migrationen in Reihenfolge. Neue nur anhaengen, nie umbenennen.
 * Regeln: idempotent, nur ergaenzen, nichts loeschen.
 */
export const migrations: Migration[] = [
  {
    id: "001-user-settings",
    description: "Einstellungen fuer bestehende Nutzer anlegen",
    up: async (db, { dryRun }) => {
      const users = await db.collection("user").find({}, { projection: { _id: 1 } }).toArray();
      const settings = db.collection<UserSettingsDoc>("user_settings");
      let created = 0;

      for (const user of users) {
        const userId = String(user._id);
        if (await settings.countDocuments({ _id: userId }, { limit: 1 })) continue;
        created += 1;
        if (dryRun) continue;

        const now = new Date();
        await settings.insertOne({
          _id: userId,
          currency: "EUR",
          locale: "de-DE",
          timeZone: "Europe/Berlin",
          reserveCents: null,
          onboardingCompletedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }

      return `${created} von ${users.length} Nutzern bekommen Einstellungen`;
    },
  },
  {
    id: "002-transfer-groups",
    description: "Alte Umbuchungen als Paar markieren (zaehlen nicht mehr als Einnahme/Ausgabe)",
    up: async (db, { dryRun }) => linkTransferPairs(db, dryRun),
  },
  {
    id: "003-refunds-to-planned",
    description: "Erstattungen als erwartete Einnahmen in 'planned' uebernehmen (Original bleibt)",
    up: async (db, { dryRun }) => {
      const refunds = await db.collection<RefundDoc>("refunds").find({}).toArray();
      const planned = db.collection<PlannedDoc>("planned");
      let copied = 0;

      for (const refund of refunds) {
        const legacyRefundId = refund._id.toString();
        if (await planned.countDocuments({ legacyRefundId }, { limit: 1 })) continue;
        copied += 1;
        if (dryRun) continue;

        await planned.insertOne({
          userId: refund.userId,
          kind: "income",
          title: refund.title,
          amountCents: refund.amountCents,
          dateFrom: refund.status === "received" ? refund.receivedDate : refund.expectedFrom,
          dateTo: refund.status === "received" ? refund.receivedDate : refund.expectedTo,
          certainty: "expected",
          status: refund.status === "received" ? "done" : "open",
          categoryId: refund.categoryId ?? null,
          accountId: refund.accountId ?? null,
          note: refund.note ?? null,
          transactionId: null,
          legacyRefundId,
          createdAt: refund.createdAt ?? new Date(),
        });
      }

      return `${copied} von ${refunds.length} Erstattungen uebernommen`;
    },
  },
  {
    id: "004-recurring-drift",
    description: "Durch den Monatsende-Fehler verrutschte Abo-Faelligkeiten korrigieren",
    up: async (db, { dryRun }) => {
      const collection = db.collection<RecurringDoc>("recurring");
      const entries = await collection.find({ interval: { $ne: "weekly" } }).toArray();
      const changes: string[] = [];

      for (const entry of entries) {
        const corrected = correctedDue(entry.startDate, entry.interval, entry.nextDue);
        if (corrected === entry.nextDue) continue;
        changes.push(`${entry.title}: ${entry.nextDue} -> ${corrected}`);
        if (!dryRun) {
          await collection.updateOne({ _id: entry._id }, { $set: { nextDue: corrected } });
        }
      }

      return changes.length === 0
        ? `keine Abweichung bei ${entries.length} Eintraegen`
        : `${changes.length} korrigiert: ${changes.join("; ")}`;
    },
  },
  {
    id: "005-planned-to-transactions",
    description: "Offene geplante/erwartete Posten als offene Buchungen uebernehmen (Original bleibt)",
    up: async (db, { dryRun }) => {
      const open = await db.collection<PlannedDoc>("planned").find({ status: "open" }).toArray();
      const target = db.collection<TransactionDoc>("transactions");
      let copied = 0;
      let undated = 0;

      for (const item of open) {
        const legacyPlannedId = item._id.toString();
        if (await target.countDocuments({ legacyPlannedId }, { limit: 1 })) continue;
        const date = item.dateFrom ?? item.dateTo;
        // Ohne Termin laesst sich der Posten nicht einplanen - nichts erfinden
        if (!date) {
          undated += 1;
          continue;
        }
        copied += 1;
        if (dryRun) continue;

        await target.insertOne({
          userId: item.userId,
          type: item.kind,
          status: "pending",
          amountCents: item.amountCents,
          title: item.title,
          note: item.note ?? null,
          date,
          categoryId: item.categoryId ?? null,
          accountId: item.accountId ?? null,
          transferGroupId: null,
          recurringId: null,
          recurringDue: null,
          legacyPlannedId,
          createdAt: item.createdAt ?? new Date(),
        });
      }

      return `${copied} von ${open.length} offenen Posten uebernommen, ${undated} ohne Termin uebersprungen`;
    },
  },
  {
    id: "006-recurring-status-cost-type",
    description: "Regelmaessige Zahlungen: Status und Kostenart ergaenzen (Feld 'active' bleibt)",
    up: async (db, { dryRun }) => {
      const collection = db.collection<RecurringDoc>("recurring");
      const entries = await collection.find({ $or: [{ status: { $exists: false } }, { costType: { $exists: false } }] }).toArray();

      for (const entry of entries) {
        if (dryRun) continue;
        const set: Partial<RecurringDoc> = {};
        if (!entry.status) set.status = entry.active === false ? "paused" : "active";
        if (!entry.costType) set.costType = entry.type === "expense" ? inferCostType(entry.title) : "other";
        await collection.updateOne({ _id: entry._id }, { $set: set });
      }

      return `${entries.length} Eintraege ergaenzt`;
    },
  },
];


/**
 * Faelligkeit wieder auf den Plan des Abos legen. Der alte Fehler hat
 * Termine um bis zu drei Tage in den Folgemonat geschoben (31.01. -> 03.03.);
 * dann gilt der Termin davor. Liegt sie sonst daneben, der naechste Termin.
 */
export function correctedDue(startDate: string, interval: RecurringDoc["interval"], nextDue: string) {
  if (interval === "weekly" || nextDue <= startDate) return nextDue;

  const window = occurrencesBetween(startDate, interval, addDays(nextDue, -4), nextDue);
  if (window.includes(nextDue)) return nextDue;

  const previous = window.at(-1);
  if (previous && daysBetween(previous, nextDue) <= 3) return previous;

  return firstOccurrenceFrom(startDate, interval, nextDue);
}

async function linkTransferPairs(db: Db, dryRun: boolean) {
  const collection = db.collection<TransactionDoc>("transactions");
  const candidates = await collection
    .find({
      note: "Umbuchung",
      title: { $regex: /^Umbuchung (an|von) / },
      $or: [{ transferGroupId: null }, { transferGroupId: { $exists: false } }],
    })
    .toArray();

  // Beide Haelften wurden in einem insertMany mit identischen Werten angelegt
  const key = (tx: (typeof candidates)[number]) =>
    `${tx.userId}|${tx.date}|${tx.amountCents}|${tx.createdAt?.getTime()}`;

  const outgoing = new Map<string, (typeof candidates)[number][]>();
  for (const tx of candidates) {
    if (tx.type === "expense") outgoing.set(key(tx), [...(outgoing.get(key(tx)) ?? []), tx]);
  }

  let pairs = 0;
  for (const incoming of candidates.filter((tx) => tx.type === "income")) {
    const match = outgoing.get(key(incoming))?.shift();
    if (!match) continue;
    pairs += 1;
    if (dryRun) continue;

    const transferGroupId = randomUUID();
    await collection.updateMany(
      { _id: { $in: [match._id, incoming._id] } },
      { $set: { transferGroupId } },
    );
  }

  return `${pairs} Umbuchungspaare aus ${candidates.length} Kandidaten verknuepft`;
}
