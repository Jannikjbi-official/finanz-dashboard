"use server";

import { z } from "zod";
import { MAX_TEMPLATES } from "../data";
import { ensureIndexes, templates, toObjectId } from "../db";
import { authorize, fail, firstIssue, ok, optionalId, optionalText, ownsAccount, ownsCategory, refresh, text, type ActionResult } from "./shared";
import { parseAmountToCents } from "../../money";

const templateSchema = z.object({
  type: z.enum(["income", "expense"]),
  title: text(120, "Bitte eine Beschreibung angeben"),
  // Leer: Betrag wird jedes Mal eingegeben (z. B. Tanken)
  amount: z
    .string()
    .optional()
    .transform((value, context) => {
      if (!value?.trim()) return null;
      const cents = parseAmountToCents(value);
      if (cents === null || cents <= 0) {
        context.addIssue({ code: "custom", message: "Bitte einen gültigen Betrag angeben oder das Feld leer lassen" });
        return z.NEVER;
      }
      return cents;
    }),
  categoryId: optionalId,
  accountId: optionalId,
  note: optionalText(500),
});

export type TemplateInput = z.input<typeof templateSchema>;

/** Vorlage aus den Werten des Buchungsdialogs. Gleicher Titel und Art: wird ersetzt. */
export async function saveTemplate(input: TemplateInput): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { amount, ...fields } = parsed.data;
  if (!(await ownsCategory(auth.userId, fields.categoryId))) return fail("Kategorie nicht gefunden");
  if (!(await ownsAccount(auth.userId, fields.accountId))) return fail("Konto nicht gefunden");
  await ensureIndexes();

  const existing = await templates.findOne({ userId: auth.userId, type: fields.type, title: fields.title });
  if (!existing && (await templates.countDocuments({ userId: auth.userId })) >= MAX_TEMPLATES) {
    return fail(`Höchstens ${MAX_TEMPLATES} Vorlagen – bitte zuerst eine unter Einstellungen löschen.`);
  }
  await templates.updateOne(
    { userId: auth.userId, type: fields.type, title: fields.title },
    { $set: { ...fields, amountCents: amount }, $setOnInsert: { userId: auth.userId, createdAt: new Date() } },
    { upsert: true },
  );
  refresh();
  return ok(existing ? `Vorlage „${fields.title}“ aktualisiert` : `Vorlage „${fields.title}“ gespeichert`);
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const _id = toObjectId(id);
  if (!_id) return fail("Vorlage nicht gefunden");
  const result = await templates.deleteOne({ _id, userId: auth.userId });
  if (result.deletedCount === 0) return fail("Vorlage nicht gefunden");
  refresh();
  return ok("Vorlage gelöscht");
}
