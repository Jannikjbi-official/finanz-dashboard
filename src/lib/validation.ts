import * as z from "zod";

const isoDate = z
  .string({ error: "Bitte ein Datum wählen." })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datum.")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Ungültiges Datum.");

/** Betrag in Cent: positiv, max. 10 Mio. € */
const cents = (label = "Betrag") =>
  z
    .number({ error: `${label} fehlt.` })
    .int(`${label} muss in Cent angegeben werden.`)
    .positive(`${label} muss größer als 0 € sein.`)
    .max(1_000_000_000, `${label} ist zu groß.`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maximal ${max} Zeichen.`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => !v || /^https?:\/\/[^\s]+$/i.test(v), "Bitte eine gültige Adresse mit https:// eingeben.");

export const paymentMethodSchema = z.enum(["bar", "karte", "paypal", "ueberweisung"], {
  error: "Bitte eine Zahlungsart wählen.",
});
export const intervalSchema = z.enum(["woechentlich", "monatlich", "vierteljaehrlich", "jaehrlich"], {
  error: "Bitte ein Intervall wählen.",
});

export const expenseSchema = z
  .object({
    clientId: z.uuid().optional(),
    amountCents: cents(),
    categoryId: z.uuid({ error: "Bitte eine Kategorie wählen." }).nullable(),
    date: isoDate,
    paymentMethod: paymentMethodSchema,
    note: optionalText(500),
    recurring: z.boolean().default(false),
    interval: intervalSchema.optional().nullable(),
  })
  .refine((v) => !v.recurring || !!v.interval, {
    path: ["interval"],
    message: "Bitte ein Intervall wählen.",
  });
export type ExpenseInput = z.input<typeof expenseSchema>;

export const expenseUpdateSchema = z.object({
  id: z.uuid(),
  amountCents: cents(),
  categoryId: z.uuid().nullable(),
  date: isoDate,
  paymentMethod: paymentMethodSchema,
  note: optionalText(500),
});

export const incomeSchema = z
  .object({
    clientId: z.uuid().optional(),
    amountCents: cents(),
    source: z.string().trim().min(1, "Bitte eine Quelle angeben.").max(60, "Maximal 60 Zeichen."),
    date: isoDate,
    note: optionalText(500),
    recurring: z.boolean().default(false),
    interval: intervalSchema.optional().nullable(),
  })
  .refine((v) => !v.recurring || !!v.interval, {
    path: ["interval"],
    message: "Bitte ein Intervall wählen.",
  });
export type IncomeInput = z.input<typeof incomeSchema>;

export const subscriptionSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Bitte einen Namen angeben.").max(80, "Maximal 80 Zeichen."),
  priceCents: cents("Preis"),
  interval: intervalSchema,
  billingDay: z
    .number({ error: "Bitte einen Abbuchungstag angeben." })
    .int()
    .min(1, "Tag 1–31.")
    .max(31, "Tag 1–31."),
  categoryId: z.uuid().nullable(),
  startDate: isoDate,
  cancellationDeadline: isoDate.nullable().optional().transform((v) => v ?? null),
  note: optionalText(500),
  status: z.enum(["aktiv", "pausiert", "gekuendigt"]),
});
export type SubscriptionInput = z.input<typeof subscriptionSchema>;

export const wishSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(1, "Bitte einen Artikel angeben.").max(120, "Maximal 120 Zeichen."),
  priceCents: cents("Preis"),
  url: optionalUrl,
  imageUrl: optionalUrl,
  priority: z.enum(["hoch", "mittel", "niedrig"]),
  note: optionalText(500),
});
export type WishInput = z.input<typeof wishSchema>;

export const categorySchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Bitte einen Namen angeben.").max(40, "Maximal 40 Zeichen."),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Ungültige Farbe."),
  icon: z.string().min(1).max(40),
  budgetCents: z.number().int().min(0).max(1_000_000_000).nullable(),
});
export type CategoryInput = z.input<typeof categorySchema>;

export const settingsSchema = z.object({
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  startBalanceCents: z.number().int().min(-1_000_000_000).max(1_000_000_000).optional(),
});

/** Felder-Fehler aus Zod für HeroUI-Formulare */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
