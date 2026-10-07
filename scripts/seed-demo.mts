/**
 * Fuellt ein bestehendes Nutzerkonto mit Beispieldaten - nur fuer die lokale
 * Entwicklung. Verweigert alles, was nicht auf localhost zeigt.
 *
 *   npm run dev:seed -- demo@example.test
 *
 * Erst im Browser registrieren (Adresse vorher mit beta:invite freischalten),
 * dann dieses Skript ausfuehren.
 *
 * Lokales Testkonto (nur .devdb): demo@example.test / lokal-testkonto-2026
 */
import { closeScriptDb, openScriptDb } from "./lib/db";

const email = process.argv.slice(2).find((arg) => arg.includes("@"))?.toLowerCase();
const uri = process.env.MONGODB_URI ?? "";

if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(uri)) {
  console.error("Abbruch: Beispieldaten nur in einer lokalen Datenbank.");
  process.exit(1);
}
if (!email) {
  console.error("E-Mail-Adresse des Testkontos angeben.");
  process.exit(1);
}

const { client, db } = await openScriptDb();

try {
  const user = await db.collection("user").findOne({ email });
  if (!user) throw new Error(`Kein Konto mit ${email} – erst registrieren.`);
  const userId = String(user._id);

  if (await db.collection("transactions").countDocuments({ userId }, { limit: 1 })) {
    throw new Error("Das Konto hat schon Buchungen – Beispieldaten werden nicht doppelt angelegt.");
  }

  const now = new Date();
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const daysAgo = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return iso(d);
  };
  const monthDay = (monthsBack: number, day: number) => {
    const d = new Date(today.getFullYear(), today.getMonth() - monthsBack, day, 12);
    return iso(d);
  };

  const categories = await db.collection("categories").find({ userId }).toArray();
  const cat = (name: string) => categories.find((c) => c.name === name)?._id.toString() ?? null;

  const giro = await db.collection("accounts").insertOne({
    userId, name: "Girokonto", kind: "giro", startBalanceCents: 1240_00, color: "#0d5a5c",
    icon: "", archived: false, liquid: true, createdAt: now,
  });
  const tagesgeld = await db.collection("accounts").insertOne({
    userId, name: "Tagesgeld", kind: "savings", startBalanceCents: 3200_00, color: "#2e6a3e",
    icon: "", archived: false, liquid: false, createdAt: now,
  });
  const giroId = giro.insertedId.toString();

  const rec = async (title: string, type: "income" | "expense", amountCents: number, day: number, categoryName: string, interval = "monthly") => {
    const start = monthDay(5, day);
    const result = await db.collection("recurring").insertOne({
      userId, type, amountCents, title, interval, categoryId: cat(categoryName),
      // Diesen Monat schon gebucht? Dann ist der naechste Monat dran.
      startDate: start, nextDue: monthDay(0, day) >= iso(today) ? monthDay(0, day) : monthDay(-1, day),
      active: true, note: null, createdAt: now,
    });
    return result.insertedId.toString();
  };

  const salary = await rec("Gehalt", "income", 2480_00, 1, "Gehalt");
  const rent = await rec("Miete", "expense", 890_00, 3, "Wohnen");
  const phone = await rec("Handyvertrag", "expense", 19_99, 12, "Verträge & Abos");
  const stream = await rec("Streaming", "expense", 13_99, 18, "Verträge & Abos");
  const transit = await rec("Deutschlandticket", "expense", 58_00, 1, "Mobilität");

  const tx: Record<string, unknown>[] = [];
  const add = (date: string, title: string, type: "income" | "expense", amountCents: number, categoryName: string | null, recurringId: string | null = null) => {
    if (date > iso(today)) return;
    tx.push({
      userId, type, amountCents, title, note: null, date, dateEnd: null, datePrecision: "day",
      categoryId: categoryName ? cat(categoryName) : null, recurringId, accountId: giroId, createdAt: now,
    });
  };

  for (let m = 4; m >= 0; m -= 1) {
    add(monthDay(m, 1), "Gehalt", "income", 2480_00, "Gehalt", salary);
    add(monthDay(m, 3), "Miete", "expense", 890_00, "Wohnen", rent);
    add(monthDay(m, 12), "Handyvertrag", "expense", 19_99, "Verträge & Abos", phone);
    add(monthDay(m, 18), "Streaming", "expense", 13_99, "Verträge & Abos", stream);
    add(monthDay(m, 1), "Deutschlandticket", "expense", 58_00, "Mobilität", transit);
    for (const [day, amount] of [[4, 64_30], [9, 48_75], [15, 71_10], [22, 55_40], [27, 39_90]] as const) {
      add(monthDay(m, day), "Wocheneinkauf", "expense", amount + m * 3_10, "Lebensmittel");
    }
    add(monthDay(m, 14), "Kino & Essen", "expense", 42_00 + (m === 0 ? 61_00 : 0), "Freizeit");
    add(monthDay(m, 25), "Drogerie", "expense", 23_45, "Sonstiges");
  }
  add(daysAgo(20), "Fahrradreparatur", "expense", 86_00, "Mobilität");

  await db.collection("transactions").insertMany(tx);

  await db.collection("goals").insertOne({
    userId, title: "Notgroschen", targetCents: 6000_00, savedCents: 3200_00, deadline: monthDay(-14, 28),
    color: "#2e6a3e", note: null, monthlyContributionCents: 150_00, accountId: tagesgeld.insertedId.toString(), createdAt: now,
  });
  await db.collection("goals").insertOne({
    userId, title: "Urlaub Portugal", targetCents: 1800_00, savedCents: 420_00, deadline: monthDay(-6, 30),
    color: "#9a6510", note: null, monthlyContributionCents: 120_00, accountId: null, createdAt: now,
  });

  await db.collection("planned").insertMany([
    {
      userId, kind: "income", title: "Erstattung Krankenkasse", amountCents: 84_50, dateFrom: daysAgo(-5), dateTo: daysAgo(-40),
      certainty: "expected", status: "open", categoryId: null, accountId: giroId, note: null, transactionId: null, createdAt: now,
    },
    {
      userId, kind: "expense", title: "Kfz-Versicherung", amountCents: 412_00, dateFrom: daysAgo(-26), dateTo: daysAgo(-26),
      certainty: "fixed", status: "open", categoryId: cat("Mobilität"), accountId: giroId, note: null, transactionId: null, createdAt: now,
    },
    {
      userId, kind: "income", title: "Steuererstattung", amountCents: 640_00, dateFrom: null, dateTo: null,
      certainty: "expected", status: "open", categoryId: null, accountId: giroId, note: null, transactionId: null, createdAt: now,
    },
  ]);

  await db.collection("categories").updateOne({ userId, name: "Lebensmittel" }, { $set: { budgetCents: 300_00 } });
  await db.collection("categories").updateOne({ userId, name: "Freizeit" }, { $set: { budgetCents: 80_00 } });
  await db.collection("user_settings").updateOne(
    { _id: userId as unknown as never },
    { $set: { reserveCents: 800_00, onboardingCompletedAt: now, updatedAt: now } },
  );

  console.log(`Beispieldaten für ${email}: ${tx.length} Buchungen, 2 Konten, 5 Abos, 2 Ziele, 3 geplante Posten.`);
} finally {
  await closeScriptDb(client);
}
