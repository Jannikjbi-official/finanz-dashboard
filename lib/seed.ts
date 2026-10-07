import { categories, ensureIndexes, type Kind } from "./mongo";

/**
 * Startkategorien fuer neue Nutzer. Gedaempfte Farben, die auf Papier und im
 * Dunkelmodus gleichermassen lesbar bleiben.
 */
const DEFAULTS: Array<{ name: string; kind: Kind; color: string }> = [
  { name: "Gehalt", kind: "income", color: "#2e6a3e" },
  { name: "Nebeneinkünfte", kind: "income", color: "#4f7f5c" },
  { name: "Erstattungen", kind: "income", color: "#6b8f72" },
  { name: "Wohnen", kind: "expense", color: "#8a4b3a" },
  { name: "Lebensmittel", kind: "expense", color: "#9a6510" },
  { name: "Mobilität", kind: "expense", color: "#3f5f86" },
  { name: "Verträge & Abos", kind: "expense", color: "#5b5f8a" },
  { name: "Versicherungen", kind: "expense", color: "#4a6b6d" },
  { name: "Freizeit", kind: "expense", color: "#8a5a7a" },
  { name: "Gesundheit", kind: "expense", color: "#5a7a4f" },
  { name: "Sonstiges", kind: "expense", color: "#6b6f75" },
];

export async function seedDefaultCategories(userId: string) {
  await ensureIndexes();

  const existing = await categories.countDocuments({ userId }, { limit: 1 });
  if (existing > 0) return;

  await categories.insertMany(
    DEFAULTS.map((entry) => ({
      ...entry,
      icon: "",
      userId,
      budgetCents: null,
      createdAt: new Date(),
    })),
  );
}
