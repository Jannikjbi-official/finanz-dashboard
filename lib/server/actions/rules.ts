"use server";

import { z } from "zod";
import { categorize } from "../../domain/rules";
import { loadRules } from "../data";
import { rules, toObjectId, transactions } from "../db";
import { authorize, fail, firstIssue, ok, optionalId, ownsAccount, ownsCategory, refresh, text, type ActionResult } from "./shared";

/**
 * Kategorisierungsregeln verwalten und anwenden (lib/domain/rules.ts).
 * Regeln greifen nur bei Buchungen ohne Kategorie und nie bei Transfers.
 */

const ruleSchema = z.object({
  id: optionalId,
  match: text(80, "Bitte einen Suchtext angeben"),
  categoryId: z.string().min(1, "Bitte eine Kategorie wählen"),
  kind: z.enum(["income", "expense"]).nullish().transform((value) => value ?? null),
  accountId: optionalId,
});

export type RuleInput = z.input<typeof ruleSchema>;

export async function saveRule(input: RuleInput): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { id, ...fields } = parsed.data;
  if (!(await ownsCategory(auth.userId, fields.categoryId))) return fail("Kategorie nicht gefunden");
  if (!(await ownsAccount(auth.userId, fields.accountId))) return fail("Konto nicht gefunden");

  if (id) {
    const _id = toObjectId(id);
    if (!_id) return fail("Regel nicht gefunden");
    const result = await rules.updateOne({ _id, userId: auth.userId }, { $set: fields });
    if (result.matchedCount === 0) return fail("Regel nicht gefunden");
  } else {
    const last = await rules.find({ userId: auth.userId }).sort({ order: -1 }).limit(1).toArray();
    await rules.insertOne({ ...fields, userId: auth.userId, order: (last[0]?.order ?? 0) + 1, createdAt: new Date() });
  }
  refresh();
  return ok("Regel gespeichert");
}

export async function deleteRule(id: string): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const _id = toObjectId(id);
  if (!_id) return fail("Regel nicht gefunden");
  await rules.deleteOne({ _id, userId: auth.userId });
  refresh();
  return ok("Regel gelöscht");
}

/** Buchungen ohne Kategorie, die eine Regel bekommen wuerden. */
async function pendingAssignments(userId: string) {
  const list = await loadRules(userId);
  if (list.length === 0) return [];
  const docs = await transactions
    .find({ userId, categoryId: { $in: [null] }, transferGroupId: { $in: [null] } }, { projection: { title: 1, note: 1, type: 1, accountId: 1 } })
    .toArray();
  return docs
    .map((doc) => ({ _id: doc._id, categoryId: categorize({ title: doc.title, note: doc.note, type: doc.type, accountId: doc.accountId ?? null }, list) }))
    .filter((item): item is { _id: (typeof docs)[number]["_id"]; categoryId: string } => item.categoryId !== null);
}

/** Wie viele vorhandene Buchungen ohne Kategorie die Regeln zuordnen wuerden. */
export async function countRuleMatches(): Promise<number> {
  const auth = await authorize();
  if ("error" in auth) return 0;
  return (await pendingAssignments(auth.userId)).length;
}

/** Regeln auf vorhandene Buchungen ohne Kategorie anwenden. */
export async function applyRulesToExisting(): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const assignments = await pendingAssignments(auth.userId);
  for (const item of assignments) {
    await transactions.updateOne({ _id: item._id, userId: auth.userId, categoryId: { $in: [null] } }, { $set: { categoryId: item.categoryId } });
  }
  refresh();
  return ok(assignments.length ? `${assignments.length} Buchungen kategorisiert` : "Keine Buchung ohne Kategorie passt zu den Regeln");
}

/**
 * "Immer so kategorisieren": Regel aus einer Buchung (Bezeichnung -> ihre
 * Kategorie) und gleich auf passende Buchungen ohne Kategorie anwenden.
 */
export async function ruleFromTransaction(transactionId: string): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const _id = toObjectId(transactionId);
  const doc = _id ? await transactions.findOne({ _id, userId: auth.userId }) : null;
  if (!doc || !doc.categoryId) return fail("Die Buchung braucht zuerst eine Kategorie");
  if (doc.transferGroupId) return fail("Transfers haben keine Kategorie");

  const match = doc.title.trim().slice(0, 80);
  const existing = await rules.findOne({ userId: auth.userId, match, kind: doc.type });
  if (existing) {
    await rules.updateOne({ _id: existing._id, userId: auth.userId }, { $set: { categoryId: doc.categoryId } });
  } else {
    const last = await rules.find({ userId: auth.userId }).sort({ order: -1 }).limit(1).toArray();
    await rules.insertOne({ userId: auth.userId, match, categoryId: doc.categoryId, kind: doc.type, accountId: null, order: (last[0]?.order ?? 0) + 1, createdAt: new Date() });
  }
  const assignments = await pendingAssignments(auth.userId);
  for (const item of assignments) {
    await transactions.updateOne({ _id: item._id, userId: auth.userId, categoryId: { $in: [null] } }, { $set: { categoryId: item.categoryId } });
  }
  refresh();
  return ok(`Regel „${match}“ gespeichert${assignments.length ? ` – ${assignments.length} weitere Buchungen kategorisiert` : ""}`);
}
