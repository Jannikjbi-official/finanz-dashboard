import { describe, expect, it } from "vitest";
import { resolveAuthUrls } from "./auth-urls";

describe("Auth-Adressen", () => {
  it("Production und lokal: BETTER_AUTH_URL, keine zusaetzlichen Origins", () => {
    expect(resolveAuthUrls({ BETTER_AUTH_URL: "https://finanzen.example.org", VERCEL_ENV: "production", VERCEL_URL: "x.vercel.app" })).toEqual({
      baseURL: "https://finanzen.example.org",
      trustedOrigins: [],
    });
    expect(resolveAuthUrls({})).toEqual({ baseURL: "http://localhost:3000", trustedOrigins: [] });
  });

  it("Preview: Branch- und Deployment-Adresse werden vertraut, Branch-Adresse ist Basis", () => {
    expect(
      resolveAuthUrls({
        BETTER_AUTH_URL: "https://finanzen.example.org",
        VERCEL_ENV: "preview",
        VERCEL_BRANCH_URL: "finanz-git-feature-team.vercel.app",
        VERCEL_URL: "finanz-abc123-team.vercel.app",
      }),
    ).toEqual({
      baseURL: "https://finanz-git-feature-team.vercel.app",
      trustedOrigins: ["https://finanz-git-feature-team.vercel.app", "https://finanz-abc123-team.vercel.app"],
    });
  });

  it("ohne BETTER_AUTH_URL: Produktionsdomain von Vercel, Schraegstrich am Ende egal", () => {
    expect(resolveAuthUrls({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "finanzen.example.org" }).baseURL).toBe("https://finanzen.example.org");
    expect(resolveAuthUrls({ BETTER_AUTH_URL: "https://finanzen.example.org/" }).baseURL).toBe("https://finanzen.example.org");
  });

  it("Preview ohne Vercel-Adressen faellt auf BETTER_AUTH_URL zurueck", () => {
    expect(resolveAuthUrls({ BETTER_AUTH_URL: "https://finanzen.example.org", VERCEL_ENV: "preview" })).toEqual({
      baseURL: "https://finanzen.example.org",
      trustedOrigins: [],
    });
  });
});
