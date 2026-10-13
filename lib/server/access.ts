import { ACCESS_DENIED_TEXT, SOCIAL_BLOCKED_TEXT } from "../auth-errors";
import { db } from "./db";

/**
 * Zugriffsregeln der privaten Anwendung - an einer Stelle.
 *
 * Grundsatz: Wer nicht ausdruecklich in ALLOWED_EMAILS steht, kommt nicht
 * hinein. Das gilt fuer Registrierung, jede Anmeldung (auch Discord) und
 * jede einzelne Anfrage. Ist die Liste leer, ist die Anwendung gesperrt
 * (fail closed).
 */

export function parseAllowlist(raw: string | undefined): string[] {
  return [...new Set((raw ?? "").split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean))];
}

export function allowedEmails() {
  return parseAllowlist(process.env.ALLOWED_EMAILS);
}

export function isAllowedEmail(email: string | null | undefined, list = allowedEmails()) {
  if (!email) return false;
  return list.includes(email.trim().toLowerCase());
}

export function accessConfigured() {
  return allowedEmails().length > 0;
}

export { ACCESS_DENIED_TEXT as ACCESS_DENIED, SOCIAL_BLOCKED_TEXT as SOCIAL_BLOCKED_WITH_2FA };

/** Codes, mit denen die Anmeldeseite die Ablehnung erklaert (lib/auth-errors.ts). */
export const REJECTION_CODE: Record<string, string> = {
  [ACCESS_DENIED_TEXT]: "ACCESS_DENIED",
  [SOCIAL_BLOCKED_TEXT]: "SOCIAL_BLOCKED_2FA",
};

/**
 * Darf fuer diesen Nutzer eine Sitzung entstehen? Liefert den Ablehnungsgrund
 * oder null. Social Logins (OAuth-Callback) umgehen die Zwei-Faktor-Pruefung
 * von Better Auth - sie sind deshalb gesperrt, sobald 2FA aktiv ist.
 */
export function sessionRejection(input: {
  email: string | null | undefined;
  twoFactorEnabled: boolean | null | undefined;
  path: string | null | undefined;
  list?: string[];
}): string | null {
  if (!isAllowedEmail(input.email, input.list)) return ACCESS_DENIED_TEXT;
  const viaOAuth = Boolean(input.path && (input.path.startsWith("/callback/") || input.path.startsWith("/oauth2/callback/")));
  if (viaOAuth && input.twoFactorEnabled) return SOCIAL_BLOCKED_TEXT;
  return null;
}

/**
 * Registrierung ist nur moeglich, solange es fuer mindestens eine erlaubte
 * Adresse noch kein Konto gibt. Danach ist sie geschlossen.
 */
export async function registrationOpen(list = allowedEmails()) {
  if (list.length === 0) return false;
  const existing = await db
    .collection("user")
    .countDocuments({ email: { $in: list } });
  return existing < list.length;
}
