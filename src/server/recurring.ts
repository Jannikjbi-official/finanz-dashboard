import "server-only";
import { and, eq, lte } from "drizzle-orm";
import { cache } from "react";
import { fromIso, todayIso } from "@/lib/dates";
import { db } from "@/lib/db";
import { expense, income, recurringRule } from "@/lib/db/schema";
import { advanceDate } from "@/lib/finance";

/**
 * Erzeugt alle fälligen Buchungen aus wiederkehrenden Regeln bis heute.
 * Idempotent und gegen parallele Aufrufe abgesichert (Zeilen-Lock).
 */
async function materialize(): Promise<number> {
  const today = todayIso();
  const due = await db
    .select({ id: recurringRule.id })
    .from(recurringRule)
    .where(and(eq(recurringRule.active, true), lte(recurringRule.nextDate, today)));
  if (due.length === 0) return 0;

  let created = 0;
  for (const { id } of due) {
    created += await db.transaction(async (tx) => {
      const [rule] = await tx.select().from(recurringRule).where(eq(recurringRule.id, id)).for("update");
      if (!rule || !rule.active) return 0;
      let next = fromIso(rule.nextDate);
      const end = fromIso(today);
      let n = 0;
      while (next.compare(end) <= 0 && n < 400) {
        const date = next.toString();
        if (rule.kind === "ausgabe") {
          await tx.insert(expense).values({
            amountCents: rule.amountCents,
            categoryId: rule.categoryId,
            date,
            paymentMethod: rule.paymentMethod ?? "karte",
            note: rule.note,
            recurringId: rule.id,
          });
        } else {
          await tx.insert(income).values({
            amountCents: rule.amountCents,
            source: rule.source ?? "Sonstiges",
            date,
            note: rule.note,
            recurringId: rule.id,
          });
        }
        next = advanceDate(next, rule.interval, rule.anchorDay);
        n++;
      }
      await tx.update(recurringRule).set({ nextDate: next.toString() }).where(eq(recurringRule.id, rule.id));
      return n;
    });
  }
  return created;
}

/** Einmal pro Request. */
export const ensureRecurringMaterialized = cache(materialize);
