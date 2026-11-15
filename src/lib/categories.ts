/** Standard-Kategorien beim ersten Start. Icons: Schlüssel aus `CATEGORY_ICONS`. */
export const DEFAULT_CATEGORIES = [
  { name: "Lebensmittel", color: "#22c55e", icon: "shopping-cart", budgetCents: 30000 },
  { name: "Essen gehen", color: "#f97316", icon: "utensils", budgetCents: 12000 },
  { name: "Transport", color: "#0ea5e9", icon: "bus", budgetCents: 8000 },
  { name: "Freizeit", color: "#a855f7", icon: "party", budgetCents: 10000 },
  { name: "Gaming", color: "#6366f1", icon: "gamepad", budgetCents: 6000 },
  { name: "Shopping", color: "#ec4899", icon: "shopping-bag", budgetCents: 10000 },
  { name: "Gesundheit", color: "#14b8a6", icon: "heart", budgetCents: null },
  { name: "Wohnen", color: "#eab308", icon: "home", budgetCents: null },
  { name: "Technik", color: "#64748b", icon: "laptop", budgetCents: null },
  { name: "Sonstiges", color: "#8b8d98", icon: "dots", budgetCents: null },
] as const;
