import { categories, ensureIndexes, type Kind } from "./mongo";

const DEFAULTS: Array<{ name: string; kind: Kind; color: string; icon: string }> = [
  { name: "Gehalt", kind: "income", color: "#22c55e", icon: "\u{1F4B6}" },
  { name: "Nebenjob", kind: "income", color: "#14b8a6", icon: "\u{1F4BC}" },
  { name: "Geschenke", kind: "income", color: "#a855f7", icon: "\u{1F381}" },
  { name: "Miete", kind: "expense", color: "#f43f5e", icon: "\u{1F3E0}" },
  { name: "Lebensmittel", kind: "expense", color: "#f59e0b", icon: "\u{1F6D2}" },
  { name: "Abos", kind: "expense", color: "#6366f1", icon: "\u{1F501}" },
  { name: "Mobilität", kind: "expense", color: "#0ea5e9", icon: "\u{1F68C}" },
  { name: "Freizeit", kind: "expense", color: "#ec4899", icon: "\u{1F3AE}" },
  { name: "Sonstiges", kind: "expense", color: "#64748b", icon: "\u{1F4E6}" },
];

export async function seedDefaultCategories(userId: string) {
  await ensureIndexes();

  const existing = await categories.countDocuments({ userId }, { limit: 1 });
  if (existing > 0) return;

  await categories.insertMany(
    DEFAULTS.map((entry) => ({
      ...entry,
      userId,
      budgetCents: null,
      createdAt: new Date(),
    })),
  );
}
