import { categories, ensureIndexes, type Kind } from "./mongo";

/**
 * Startkategorien fuer neue Nutzer. Kraeftige Farben, die auf dunklem Grund leuchten.
 */
const DEFAULTS: Array<{ name: string; kind: Kind; color: string }> = [
  { name: "Gehalt", kind: "income", color: "#8be36b" },
  { name: "Nebeneinkünfte", kind: "income", color: "#a3e635" },
  { name: "Erstattungen", kind: "income", color: "#6ee7d8" },
  { name: "Wohnen", kind: "expense", color: "#ff9a52" },
  { name: "Lebensmittel", kind: "expense", color: "#f5c451" },
  { name: "Mobilität", kind: "expense", color: "#38bdf8" },
  { name: "Verträge & Abos", kind: "expense", color: "#8b9cff" },
  { name: "Versicherungen", kind: "expense", color: "#6ee7d8" },
  { name: "Freizeit", kind: "expense", color: "#f472b6" },
  { name: "Gesundheit", kind: "expense", color: "#c084fc" },
  { name: "Sonstiges", kind: "expense", color: "#9aa3ad" },
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
