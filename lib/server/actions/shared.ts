import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isISODate, todayIn } from "../../domain/calendar";
import { parseAmountToCents } from "../../money";
import { accounts, categories, toObjectId } from "../db";
import { limitUser } from "../rate-limit";
import { getCurrentUser } from "../session";
import { getSettings } from "../user-data";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export const ok = (message?: string): ActionResult => ({ ok: true, message });
export const fail = (error: string): ActionResult => ({ ok: false, error });

/** Angemeldeter Nutzer mit Schreibkontingent - oder eine Fehlermeldung. */
export async function authorize(kind: "write" | "import" = "write"): Promise<{ userId: string } | { error: ActionResult }> {
  const user = await getCurrentUser();
  if (!user) return { error: fail("Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.") };
  const limit = await limitUser(user.id, kind);
  if (!limit.allowed) {
    return { error: fail(`Zu viele Änderungen in kurzer Zeit. Bitte in ${limit.retryAfterSeconds} Sekunden erneut versuchen.`) };
  }
  return { userId: user.id };
}

/** Alle Seiten lesen dieselben Daten - nach jeder Aenderung alles neu laden. */
export function refresh() {
  revalidatePath("/", "layout");
}

/** Erste verstaendliche Meldung aus einer Zod-Validierung. */
export function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Eingabe ungültig";
}

export const isoDate = z.string().refine(isISODate, "Bitte ein gültiges Datum angeben");
export const optionalIsoDate = z
  .string()
  .nullish()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || isISODate(value), "Bitte ein gültiges Datum angeben");

/** Positiver Betrag aus deutscher Eingabe ("1.234,56") in Cent. */
export const positiveAmount = z
  .string({ message: "Betrag fehlt" })
  .transform((value) => parseAmountToCents(value))
  .refine((value): value is number => value !== null && value > 0, "Bitte einen Betrag größer als 0 angeben")
  .refine((value) => value! <= 100_000_000_00, "Betrag ist unrealistisch hoch");

/** Betrag mit optionalem Minus (z. B. Anfangssaldo eines ueberzogenen Kontos). */
export const signedAmount = z.string().transform((value, context) => {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const negative = /^[-−]/.test(trimmed);
  const cents = parseAmountToCents(trimmed.replace(/^[-−]\s*/, ""));
  if (cents === null) {
    context.addIssue({ code: "custom", message: "Bitte einen gültigen Betrag angeben" });
    return z.NEVER;
  }
  return negative ? -cents : cents;
});

export const text = (max: number, message = "Bitte ausfüllen") => z.string().trim().min(1, message).max(max, `Höchstens ${max} Zeichen`);
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Höchstens ${max} Zeichen`)
    .nullish()
    .transform((value) => (value ? value : null));

/** Dateiname eines Imports, nur zur Anzeige. */
export const fileNameSchema = z
  .string()
  .trim()
  .max(200)
  .nullish()
  .transform((value) => (value ? value : null));

export const optionalId = z
  .string()
  .nullish()
  .transform((value) => (value && value !== "none" ? value : null));

/** Gehoert das Konto dem Nutzer? Archivierte Konten nimmt nur das Bearbeiten an. */
export async function ownsAccount(userId: string, id: string | null, options: { allowArchived?: boolean } = {}) {
  if (id === null) return true;
  const _id = toObjectId(id);
  if (!_id) return false;
  const filter = options.allowArchived ? { _id, userId } : { _id, userId, archived: false };
  return (await accounts.countDocuments(filter, { limit: 1 })) > 0;
}

export async function ownsCategory(userId: string, id: string | null) {
  if (id === null) return true;
  const _id = toObjectId(id);
  if (!_id) return false;
  return (await categories.countDocuments({ _id, userId }, { limit: 1 })) > 0;
}

/** Kontostand mit Datum: nur bis heute, die Zukunft kennt die Bank noch nicht. */
export async function anchorFor(userId: string, amountCents: number, date: string | null | undefined) {
  const today = todayIn((await getSettings(userId)).timeZone);
  const day = date ?? today;
  if (day > today) return { ok: false as const, error: "Das Datum des Kontostands liegt in der Zukunft." };
  return { ok: true as const, anchor: { date: day, amountCents } };
}
