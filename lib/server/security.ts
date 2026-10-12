import "server-only";
import { headers } from "next/headers";
import { auth } from "./auth";

export type SessionInfo = {
  id: string;
  current: boolean;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  ipAddress: string | null;
  device: string;
};

/** Grobe, lesbare Geraetebeschreibung aus dem User-Agent. */
export function describeDevice(userAgent: string | null | undefined) {
  if (!userAgent) return "Unbekanntes Gerät";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Browser";
  const system = /iPhone|iPad/.test(userAgent)
    ? "iOS"
    : /Android/.test(userAgent)
      ? "Android"
      : /Mac OS X/.test(userAgent)
        ? "macOS"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "";
  return system ? `${browser} auf ${system}` : browser;
}

/**
 * Sicherheitsstand des angemeldeten Nutzers fuer die Einstellungen.
 * Sitzungs-Tokens verlassen den Server nicht - nur IDs.
 */
export async function getSecurityOverview() {
  const requestHeaders = await headers();
  const [current, sessions, accounts] = await Promise.all([
    auth.api.getSession({ headers: requestHeaders }),
    auth.api.listSessions({ headers: requestHeaders }),
    auth.api.listUserAccounts({ headers: requestHeaders }),
  ]);

  const list: SessionInfo[] = sessions
    .map((session) => ({
      id: String(session.id),
      current: session.token === current?.session.token,
      createdAt: new Date(session.createdAt).toISOString(),
      lastActiveAt: new Date(session.updatedAt).toISOString(),
      expiresAt: new Date(session.expiresAt).toISOString(),
      ipAddress: session.ipAddress ?? null,
      device: describeDevice(session.userAgent),
    }))
    .sort((a, b) => Number(b.current) - Number(a.current) || b.lastActiveAt.localeCompare(a.lastActiveAt));

  return {
    twoFactorEnabled: Boolean((current?.user as { twoFactorEnabled?: boolean } | undefined)?.twoFactorEnabled),
    hasPassword: accounts.some((account) => account.providerId === "credential"),
    providers: accounts.map((account) => account.providerId),
    sessions: list,
  };
}
