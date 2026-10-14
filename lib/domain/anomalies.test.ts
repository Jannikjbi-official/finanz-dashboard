import { describe, expect, it } from "vitest";
import { findAnomalies } from "./anomalies";
import type { Category, Transaction } from "./types";

const food: Category = { id: "food", name: "Lebensmittel", kind: "expense", color: "#5f9e8f" };
let seq = 0;
const tx = (date: string, amountCents: number, title: string, overrides: Partial<Transaction> = {}): Transaction => ({
  id: `t${String((seq += 1)).padStart(3, "0")}`,
  type: "expense",
  status: "booked",
  amountCents,
  date,
  title,
  note: null,
  categoryId: "food",
  accountId: "giro",
  transferGroupId: null,
  recurringId: null,
  recurringDue: null,
  ...overrides,
});

const TODAY = "2026-10-14";

describe("Auffaelligkeiten", () => {
  it("erkennt doppelte Buchungen (z. B. von Hand erfasst und importiert), aber nicht aus derselben Datei", () => {
    const manual = tx("2026-10-10", 12_50, "Lidl");
    const imported = tx("2026-10-11", 12_50, "LIDL SAGT DANKE 4711", { importId: "imp1" });
    const twinA = tx("2026-10-12", 3_20, "Bäcker", { importId: "imp1" });
    const twinB = tx("2026-10-12", 3_20, "Bäcker", { importId: "imp1" });
    const otherAccount = tx("2026-10-11", 12_50, "Lidl", { accountId: "revolut" });
    const far = tx("2026-10-01", 12_50, "Lidl");
    const anomalies = findAnomalies({ transactions: [manual, imported, twinA, twinB, otherAccount, far], categories: [food], today: TODAY });
    const dups = anomalies.filter((anomaly) => anomaly.kind === "duplicate");
    expect(dups).toHaveLength(1);
    expect(dups[0]).toMatchObject({ key: `dup:${[manual.id, imported.id].sort().join(":")}` });

    // "Passt" blendet sie aus
    expect(findAnomalies({ transactions: [manual, imported], categories: [food], today: TODAY, dismissed: [dups[0].key] })).toEqual([]);
  });

  it("meldet ungewoehnlich hohe Einzelausgaben erst mit genug Vergleichswerten", () => {
    const usual = ["2026-08-01", "2026-08-15", "2026-09-01", "2026-09-15", "2026-10-01"].map((date) => tx(date, 20_00, `Einkauf ${date}`));
    const big = tx("2026-10-12", 95_00, "Großeinkauf");
    const result = findAnomalies({ transactions: [...usual, big], categories: [food], today: TODAY }).filter((anomaly) => anomaly.kind === "large");
    expect(result).toEqual([{ key: `large:${big.id}`, kind: "large", transaction: big, typical: 20_00, categoryName: "Lebensmittel" }]);
    // Mit nur vier Vergleichswerten: keine Meldung
    expect(findAnomalies({ transactions: [...usual.slice(1), big], categories: [food], today: TODAY }).filter((anomaly) => anomaly.kind === "large")).toEqual([]);
  });

  it("meldet Kategorien deutlich ueber dem Durchschnitt vollstaendiger Monate", () => {
    const transactions = [
      tx("2026-07-30", 1_00, "Start"),
      tx("2026-08-10", 100_00, "Aug"),
      tx("2026-09-10", 100_00, "Sep"),
      tx("2026-10-05", 150_00, "Okt"),
    ];
    const result = findAnomalies({ transactions, categories: [food], today: TODAY }).filter((anomaly) => anomaly.kind === "category");
    expect(result).toEqual([expect.objectContaining({ key: "cat:food:2026-10", stat: expect.objectContaining({ amount: 150_00, average: 100_00 }) })]);
    // 110 € statt 100 €: noch keine Meldung
    expect(findAnomalies({ transactions: [...transactions.slice(0, 3), tx("2026-10-05", 110_00, "Okt")], categories: [food], today: TODAY }).filter((a) => a.kind === "category")).toEqual([]);
  });
});
