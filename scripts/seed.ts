/**
 * Beispieldaten für die LOKALE Entwicklung.
 *   npm run db:seed
 * Verweigert die Ausführung auf Vercel/Neon bzw. in Produktion.
 */
import "dotenv/config";
import { endOfMonth, startOfMonth, today } from "@internationalized/date";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { DEFAULT_CATEGORIES } from "../src/lib/categories";
import * as schema from "../src/lib/db/schema";

const url = process.env.DATABASE_URL ?? "";
if (process.env.NODE_ENV === "production" || process.env.VERCEL || /neon\.tech|vercel/i.test(url)) {
  if (!process.argv.includes("--wirklich-auf-remote")) {
    console.error("✖ Seed läuft nur lokal (nicht auf Vercel/Neon/Produktion).");
    process.exit(1);
  }
}

const pool = new Pool({ connectionString: url, max: 1 });
const db = drizzle({ client: pool, schema, casing: "snake_case" });

// Deterministischer Zufall
let s = 42;
const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!;
const between = (min: number, max: number) => Math.round(min + rand() * (max - min));

async function main() {
  console.log("→ Lösche vorhandene Finanzdaten …");
  await db.delete(schema.expense);
  await db.delete(schema.income);
  await db.delete(schema.recurringRule);
  await db.delete(schema.subscription);
  await db.delete(schema.wish);
  await db.delete(schema.category);
  await db.delete(schema.appSetting);

  const cats = await db
    .insert(schema.category)
    .values(DEFAULT_CATEGORIES.map((c, i) => ({ ...c, sortOrder: i })))
    .returning();
  const cat = (name: string) => cats.find((c) => c.name === name)!.id;

  const now = today("Europe/Berlin");
  const notes: Record<string, string[]> = {
    Lebensmittel: ["Rewe", "Lidl", "Edeka", "Aldi", "Wochenmarkt", "dm"],
    "Essen gehen": ["Döner", "Pizza", "Sushi mit Freunden", "Mensa", "Burger"],
    Transport: ["Deutschlandticket", "Tanken", "Bahn", "Uber"],
    Freizeit: ["Kino", "Konzert", "Bowling", "Schwimmbad"],
    Gaming: ["Steam Sale", "Skin", "Indie-Game", "Controller"],
    Shopping: ["Hoodie", "Sneaker", "Amazon", "Zalando"],
    Gesundheit: ["Apotheke", "Zahnreinigung"],
    Technik: ["USB-C-Kabel", "Mikrofon-Arm", "SSD"],
    Sonstiges: ["Geschenk", "Friseur", "Spende"],
  };
  const weights: [string, number, [number, number]][] = [
    ["Lebensmittel", 9, [800, 6500]],
    ["Essen gehen", 4, [700, 3500]],
    ["Transport", 3, [300, 6000]],
    ["Freizeit", 2, [900, 4500]],
    ["Gaming", 2, [500, 5999]],
    ["Shopping", 2, [1500, 8900]],
    ["Gesundheit", 1, [400, 3000]],
    ["Technik", 1, [999, 12999]],
    ["Sonstiges", 1, [500, 4000]],
  ];
  const bag = weights.flatMap(([n, w]) => Array.from({ length: w }, () => n));
  const methods = ["karte", "karte", "karte", "bar", "paypal", "ueberweisung"] as const;

  const expenses: (typeof schema.expense.$inferInsert)[] = [];
  const incomes: (typeof schema.income.$inferInsert)[] = [];

  for (let m = 11; m >= 0; m--) {
    const first = startOfMonth(now).subtract({ months: m });
    const last = m === 0 ? now : endOfMonth(first);
    incomes.push({ amountCents: 245000, source: "Gehalt", date: first.set({ day: Math.min(28, last.day) }).toString() });
    if (rand() > 0.2) {
      incomes.push({ amountCents: between(4000, 26000), source: "Twitch", date: first.set({ day: Math.min(15, last.day) }).toString() });
    }
    if (rand() > 0.6) {
      incomes.push({ amountCents: between(8000, 30000), source: "Nebenjob", date: first.set({ day: Math.min(20, last.day) }).toString() });
    }
    expenses.push({
      amountCents: 52000,
      categoryId: cat("Wohnen"),
      date: first.set({ day: 1 }).toString(),
      paymentMethod: "ueberweisung",
      note: "Miete",
    });
    const count = between(22, 34) * (last.day / endOfMonth(first).day);
    for (let i = 0; i < count; i++) {
      const name = pick(bag);
      const range = weights.find((w) => w[0] === name)![2];
      expenses.push({
        amountCents: between(range[0], range[1]),
        categoryId: cat(name),
        date: first.set({ day: between(1, last.day) }).toString(),
        paymentMethod: pick(methods),
        note: notes[name] ? pick(notes[name]) : null,
      });
    }
  }
  await db.insert(schema.expense).values(expenses);
  await db.insert(schema.income).values(incomes);

  const start = startOfMonth(now).subtract({ months: 14 }).toString();
  await db.insert(schema.subscription).values([
    { name: "Netflix", priceCents: 1399, interval: "monatlich", billingDay: 5, categoryId: cat("Freizeit"), startDate: start, status: "aktiv" },
    { name: "Spotify", priceCents: 1199, interval: "monatlich", billingDay: Math.min(28, now.day + 2), categoryId: cat("Freizeit"), startDate: start, status: "aktiv" },
    { name: "Xbox Game Pass", priceCents: 1799, interval: "monatlich", billingDay: 12, categoryId: cat("Gaming"), startDate: start, status: "aktiv", cancellationDeadline: now.add({ days: 9 }).toString() },
    { name: "iCloud+ 200 GB", priceCents: 299, interval: "monatlich", billingDay: Math.min(28, now.day + 4), categoryId: cat("Technik"), startDate: start, status: "aktiv" },
    { name: "Fitnessstudio", priceCents: 8997, interval: "vierteljaehrlich", billingDay: 1, categoryId: cat("Gesundheit"), startDate: start, status: "aktiv" },
    { name: "Amazon Prime", priceCents: 8990, interval: "jaehrlich", billingDay: 18, categoryId: cat("Shopping"), startDate: start, status: "aktiv" },
    { name: "Disney+", priceCents: 999, interval: "monatlich", billingDay: 20, categoryId: cat("Freizeit"), startDate: start, status: "pausiert" },
  ]);

  await db.insert(schema.wish).values([
    { title: "Sony WH-1000XM6", priceCents: 39900, priority: "hoch", savedCents: 22000, url: "https://www.sony.de", imageUrl: null, note: "Für Streams & Reisen" },
    { title: "Elgato Stream Deck+", priceCents: 22999, priority: "mittel", savedCents: 5000, url: null, imageUrl: null },
    { title: "Neues Bürostuhl-Polster", priceCents: 4999, priority: "niedrig", savedCents: 0, url: null, imageUrl: null },
    { title: "Wochenende in Kopenhagen", priceCents: 65000, priority: "mittel", savedCents: 12000, url: null, imageUrl: null },
  ]);

  await db.insert(schema.recurringRule).values({
    kind: "ausgabe",
    amountCents: 2500,
    interval: "monatlich",
    categoryId: cat("Sonstiges"),
    paymentMethod: "ueberweisung",
    note: "Sparplan ETF",
    anchorDay: 15,
    nextDate: (now.day < 15 ? now.set({ day: 15 }) : startOfMonth(now).add({ months: 1 }).set({ day: 15 })).toString(),
  });

  await db.insert(schema.appSetting).values({ key: "startBalanceCents", value: 180000 });

  console.log(`✔ ${expenses.length} Ausgaben, ${incomes.length} Einnahmen, 7 Abos, 4 Wünsche angelegt`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());
