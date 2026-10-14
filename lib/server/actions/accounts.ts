"use server";

import { z } from "zod";
import { accounts, categories, ensureIndexes, planned, recurring, settings, toObjectId, transactions } from "../db";
import {
  anchorFor,
  authorize,
  fail,
  firstIssue,
  ok,
  optionalId,
  optionalIsoDate,
  refresh,
  signedAmount,
  text,
  type ActionResult,
} from "./shared";

/* --------------------------------- Konten --------------------------------- */

const accountSchema = z.object({
  id: optionalId,
  name: text(60, "Bitte einen Namen angeben"),
  kind: z.enum(["giro", "savings", "cash", "paypal", "other"], { message: "Bitte eine Kontoart wählen" }),
  /** Altes Feld: Saldo vor der ersten Buchung. Nur noch ohne Kontostand mit Datum. */
  startBalance: signedAmount.optional(),
  /** Kontostand laut Bank und der Tag, fuer den er gilt. */
  balance: signedAmount.optional(),
  balanceDate: optionalIsoDate,
  liquid: z.boolean(),
});

export type AccountInput = z.input<typeof accountSchema>;

export async function saveAccount(input: AccountInput): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { id, name, kind, startBalance, liquid } = parsed.data;
  await ensureIndexes();

  // Leeres Feld = kein neuer Kontostand; dann gilt wie bisher der Anfangssaldo
  const hasBalance = typeof input.balance === "string" && input.balance.trim() !== "";
  let anchor: { date: string; amountCents: number } | undefined;
  if (hasBalance) {
    const result = await anchorFor(auth.userId, parsed.data.balance ?? 0, parsed.data.balanceDate);
    if (!result.ok) return fail(result.error);
    anchor = result.anchor;
  }

  const fields = {
    name,
    kind,
    liquid,
    updatedAt: new Date(),
    ...(anchor ? { balanceAnchor: anchor } : {}),
    ...(startBalance !== undefined && !anchor ? { startBalanceCents: startBalance } : {}),
  };
  if (id) {
    const _id = toObjectId(id);
    if (!_id) return fail("Konto nicht gefunden");
    const result = await accounts.updateOne({ _id, userId: auth.userId }, { $set: fields });
    if (result.matchedCount === 0) return fail("Konto nicht gefunden");
    refresh();
    return ok("Konto gespeichert");
  }

  await accounts.insertOne({ startBalanceCents: 0, ...fields, userId: auth.userId, archived: false, createdAt: new Date() });
  refresh();
  return ok("Konto angelegt");
}

const anchorSchema = z.object({
  accountId: z.string().min(1),
  balance: signedAmount,
  date: optionalIsoDate,
});

export type BalanceAnchorInput = z.input<typeof anchorSchema>;

/**
 * Kontostand abgleichen: "laut Bank X € am Tag Y". Ab dann rechnet das Konto
 * von hier aus; aeltere Buchungen stecken im Stand, neuere kommen dazu.
 */
export async function setBalanceAnchor(input: BalanceAnchorInput): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const parsed = anchorSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const _id = toObjectId(parsed.data.accountId);
  if (!_id) return fail("Konto nicht gefunden");

  const result = await anchorFor(auth.userId, parsed.data.balance, parsed.data.date);
  if (!result.ok) return fail(result.error);
  const updated = await accounts.updateOne({ _id, userId: auth.userId }, { $set: { balanceAnchor: result.anchor, updatedAt: new Date() } });
  if (updated.matchedCount === 0) return fail("Konto nicht gefunden");
  refresh();
  return ok("Kontostand übernommen");
}

export async function setAccountArchived(id: string, archived: boolean): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const _id = toObjectId(id);
  if (!_id) return fail("Konto nicht gefunden");
  await accounts.updateOne({ _id, userId: auth.userId }, { $set: { archived: Boolean(archived), updatedAt: new Date() } });
  refresh();
  return ok(archived ? "Konto archiviert – es zählt nicht mehr zum Guthaben" : "Konto wiederhergestellt");
}

/** Loeschen nur ohne Buchungen - sonst verschwindet Historie. Dann archivieren. */
export async function deleteAccount(id: string): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const _id = toObjectId(id);
  if (!_id) return fail("Konto nicht gefunden");

  const [used, linked] = await Promise.all([
    transactions.countDocuments({ userId: auth.userId, accountId: id }, { limit: 1 }),
    recurring.countDocuments({ userId: auth.userId, accountId: id }, { limit: 1 }),
  ]);
  if (used + linked > 0) return fail("Das Konto hat Buchungen oder regelmäßige Zahlungen. Archiviere es stattdessen.");

  await accounts.deleteOne({ _id, userId: auth.userId });
  refresh();
  return ok("Konto gelöscht");
}

/* ------------------------------- Kategorien ------------------------------- */

const categorySchema = z.object({
  id: optionalId,
  name: text(40, "Bitte einen Namen angeben"),
  kind: z.enum(["income", "expense"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Farbe ungültig"),
});

export type CategoryInput = z.input<typeof categorySchema>;

export async function saveCategory(input: CategoryInput): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { id, ...fields } = parsed.data;
  await ensureIndexes();

  try {
    if (id) {
      const _id = toObjectId(id);
      if (!_id) return fail("Kategorie nicht gefunden");
      await categories.updateOne({ _id, userId: auth.userId }, { $set: fields });
    } else {
      await categories.insertOne({ ...fields, userId: auth.userId, createdAt: new Date() });
    }
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return fail("Diese Kategorie gibt es schon");
    throw error;
  }
  refresh();
  return ok(id ? "Kategorie gespeichert" : "Kategorie angelegt");
}

/** Kategorie loeschen; Buchungen und Zahlungen behalten ihre Daten, nur ohne Kategorie. */
export async function deleteCategory(id: string): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const _id = toObjectId(id);
  if (!_id) return fail("Kategorie nicht gefunden");

  const result = await categories.deleteOne({ _id, userId: auth.userId });
  if (result.deletedCount === 0) return fail("Kategorie nicht gefunden");
  await Promise.all([
    transactions.updateMany({ userId: auth.userId, categoryId: id }, { $set: { categoryId: null } }),
    recurring.updateMany({ userId: auth.userId, categoryId: id }, { $set: { categoryId: null } }),
    planned.updateMany({ userId: auth.userId, categoryId: id }, { $set: { categoryId: null } }),
  ]);
  refresh();
  return ok("Kategorie gelöscht");
}

/* ------------------------------ Einstellungen ----------------------------- */

export async function saveTimeZone(timeZone: string): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  try {
    new Intl.DateTimeFormat("de-DE", { timeZone });
  } catch {
    return fail("Unbekannte Zeitzone");
  }
  await settings.updateOne({ _id: auth.userId }, { $set: { timeZone, updatedAt: new Date() } }, { upsert: true });
  refresh();
  return ok("Zeitzone gespeichert");
}
