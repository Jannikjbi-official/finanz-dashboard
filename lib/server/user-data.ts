import "server-only";
import { categories, db, ensureIndexes, settings, USER_DATA_COLLECTIONS, type SettingsDoc } from "./db";

export const DEFAULT_TIME_ZONE = "Europe/Berlin";

/** Grundkategorien - nur Struktur, keine Finanzwerte. */
const DEFAULT_CATEGORIES: Array<{ name: string; kind: "income" | "expense"; color: string }> = [
  { name: "Gehalt", kind: "income", color: "#5f9e8f" },
  { name: "Sonstige Einnahmen", kind: "income", color: "#7c9c74" },
  { name: "Wohnen", kind: "expense", color: "#b08a5a" },
  { name: "Lebensmittel", kind: "expense", color: "#a39462" },
  { name: "Mobilität", kind: "expense", color: "#6f8fa8" },
  { name: "Verträge & Abos", kind: "expense", color: "#8a84a8" },
  { name: "Versicherungen", kind: "expense", color: "#6d9a9a" },
  { name: "Freizeit", kind: "expense", color: "#a87a86" },
  { name: "Gesundheit", kind: "expense", color: "#8f9f78" },
  { name: "Sonstiges", kind: "expense", color: "#8b8f94" },
];

export async function getSettings(userId: string): Promise<{ timeZone: string }> {
  const doc = await settings.findOne({ _id: userId }, { projection: { timeZone: 1 } });
  return { timeZone: typeof doc?.timeZone === "string" ? doc.timeZone : DEFAULT_TIME_ZONE };
}

/** Abgelehnte Vorschlaege "regelmaessige Zahlung erkannt" (siehe recurring-detect.ts). */
export async function getDismissedSuggestions(userId: string): Promise<string[]> {
  const doc = await settings.findOne({ _id: userId }, { projection: { dismissedRecurringSuggestions: 1 } });
  return Array.isArray(doc?.dismissedRecurringSuggestions) ? (doc.dismissedRecurringSuggestions as string[]) : [];
}

/** Mit "Passt" ausgeblendete Auffaelligkeiten. */
export async function getDismissedAnomalies(userId: string): Promise<string[]> {
  const doc = await settings.findOne({ _id: userId }, { projection: { dismissedAnomalies: 1 } });
  return Array.isArray(doc?.dismissedAnomalies) ? (doc.dismissedAnomalies as string[]) : [];
}

/** Einstellungen und Grundkategorien fuer neue Nutzer. Idempotent. */
export async function ensureUserSetup(userId: string) {
  await ensureIndexes();
  const now = new Date();
  await settings.updateOne(
    { _id: userId },
    { $setOnInsert: { _id: userId, currency: "EUR", locale: "de-DE", timeZone: DEFAULT_TIME_ZONE, createdAt: now, updatedAt: now } as SettingsDoc },
    { upsert: true },
  );

  if ((await categories.countDocuments({ userId }, { limit: 1 })) > 0) return;
  await categories.insertMany(DEFAULT_CATEGORIES.map((entry) => ({ ...entry, userId, createdAt: now })));
}

/** Vollstaendiger Export aller Daten eines Nutzers als JSON-faehiges Objekt. */
export async function exportUserData(userId: string) {
  const result: Record<string, unknown[]> = {};
  for (const name of USER_DATA_COLLECTIONS) {
    const docs = await db.collection(name).find({ userId }, { projection: { userId: 0 } }).toArray();
    result[name] = docs.map(({ _id, ...rest }) => ({ id: String(_id), ...rest }));
  }
  const own = await settings.findOne({ _id: userId }, { projection: { _id: 0 } });
  result.settings = own ? [own] : [];
  return result;
}
