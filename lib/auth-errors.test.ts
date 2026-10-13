import { describe, expect, it } from "vitest";
import { signInErrorMessage } from "./auth-errors";

describe("Meldungen auf der Anmeldeseite", () => {
  it("uebersetzt bekannte Codes und zeigt sonst einen festen Text", () => {
    expect(signInErrorMessage("ACCESS_DENIED")).toBe("Für diese Adresse besteht kein Zugang.");
    expect(signInErrorMessage("ACCESS_REVOKED")).toContain("nicht mehr freigegeben");
    expect(signInErrorMessage("access_denied")).toContain("abgebrochen");
    expect(signInErrorMessage("<b>Ruf mich an</b>")).toBe("Die Anmeldung hat nicht geklappt. Bitte noch einmal versuchen.");
    expect(signInErrorMessage(null)).toBeNull();
  });
});
