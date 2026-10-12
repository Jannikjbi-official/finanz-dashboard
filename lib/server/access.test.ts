import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestMongo } from "@/test/mongo";

let env: Awaited<ReturnType<typeof startTestMongo>>;
let access: typeof import("./access");

beforeAll(async () => {
  env = await startTestMongo("access");
  access = await import("./access");
});

afterAll(async () => {
  await env?.stop();
});

describe("Zugriffsregeln", () => {
  it("liest die Freigabeliste robust", () => {
    expect(access.parseAllowlist(" A@Example.org, b@example.org ,,a@example.org")).toEqual(["a@example.org", "b@example.org"]);
    expect(access.parseAllowlist(undefined)).toEqual([]);
  });

  it("laesst nur freigegebene Adressen zu - Gross-/Kleinschreibung egal", () => {
    const list = ["ich@example.org"];
    expect(access.isAllowedEmail("Ich@Example.org", list)).toBe(true);
    expect(access.isAllowedEmail("fremd@example.org", list)).toBe(false);
    expect(access.isAllowedEmail(null, list)).toBe(false);
  });

  it("leere Liste sperrt alles (fail closed)", () => {
    expect(access.isAllowedEmail("ich@example.org", [])).toBe(false);
    expect(access.sessionRejection({ email: "ich@example.org", twoFactorEnabled: false, path: "/sign-in/email", list: [] })).toBe(access.ACCESS_DENIED);
  });

  it("verweigert Sitzungen fuer nicht freigegebene Adressen", () => {
    const list = ["ich@example.org"];
    expect(access.sessionRejection({ email: "ich@example.org", twoFactorEnabled: false, path: "/sign-in/email", list })).toBeNull();
    expect(access.sessionRejection({ email: "beta@example.org", twoFactorEnabled: false, path: "/sign-in/email", list })).toBe(access.ACCESS_DENIED);
  });

  it("sperrt Social Login, sobald Zwei-Faktor aktiv ist - er wuerde den Code umgehen", () => {
    const list = ["ich@example.org"];
    expect(access.sessionRejection({ email: "ich@example.org", twoFactorEnabled: true, path: "/callback/discord", list })).toBe(access.SOCIAL_BLOCKED_WITH_2FA);
    expect(access.sessionRejection({ email: "ich@example.org", twoFactorEnabled: false, path: "/callback/discord", list })).toBeNull();
    // Abschluss der 2FA-Pruefung erzeugt die eigentliche Sitzung
    expect(access.sessionRejection({ email: "ich@example.org", twoFactorEnabled: true, path: "/two-factor/verify-totp", list })).toBeNull();
  });

  it("schliesst die Registrierung, sobald alle freigegebenen Adressen ein Konto haben", async () => {
    const { db } = await import("./db");
    const list = ["ich@example.org", "partner@example.org"];
    expect(await access.registrationOpen([])).toBe(false);
    expect(await access.registrationOpen(list)).toBe(true);
    await db.collection("user").insertOne({ email: "ich@example.org", name: "Ich" });
    expect(await access.registrationOpen(list)).toBe(true);
    await db.collection("user").insertOne({ email: "partner@example.org", name: "P" });
    expect(await access.registrationOpen(list)).toBe(false);
    // Fremde Konten (z. B. alte Beta-Nutzer) oeffnen nichts
    await db.collection("user").insertOne({ email: "beta@example.org", name: "B" });
    expect(await access.registrationOpen(["ich@example.org"])).toBe(false);
  });
});
