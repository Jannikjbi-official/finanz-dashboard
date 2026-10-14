import { describe, expect, it } from "vitest";
import { categorize, type CategoryRule } from "./rules";

const rule = (overrides: Partial<CategoryRule>): CategoryRule => ({ id: "r", match: "lidl", categoryId: "food", kind: null, accountId: null, order: 1, ...overrides });

describe("Kategorisierungsregeln", () => {
  it("findet Text in Bezeichnung oder Notiz, die erste Regel gewinnt", () => {
    const rules = [rule({ id: "b", match: "paypal", categoryId: "fun", order: 2 }), rule({ id: "a", match: "PayPal G2A", categoryId: "games", order: 1 })];
    expect(categorize({ title: "PayPal G2A", type: "expense" }, rules)).toBe("games");
    expect(categorize({ title: "PayPal", type: "expense" }, rules)).toBe("fun");
    expect(categorize({ title: "Karte", note: "Lidl Wilhelmshavener", type: "expense" }, [rule({})])).toBe("food");
    expect(categorize({ title: "Rewe", type: "expense" }, [rule({})])).toBeNull();
  });

  it("beachtet Art und Konto", () => {
    expect(categorize({ title: "Lidl Erstattung", type: "income" }, [rule({ kind: "expense" })])).toBeNull();
    expect(categorize({ title: "Lidl", type: "expense", accountId: "rev" }, [rule({ accountId: "giro" })])).toBeNull();
    expect(categorize({ title: "Lidl", type: "expense", accountId: "giro" }, [rule({ accountId: "giro" })])).toBe("food");
  });
});
