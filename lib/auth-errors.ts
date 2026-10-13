/**
 * Fehlercodes, mit denen die Anmeldeseite aufgerufen wird
 * (/anmelden?error=...), als deutsche Meldung. Bewusst nur feste Texte: ein
 * mitgeschickter Beschreibungstext wird nie angezeigt, sonst liesse sich per
 * Link beliebiger Text auf die Anmeldeseite bringen.
 */

export const ACCESS_DENIED_TEXT = "Für diese Adresse besteht kein Zugang.";
export const SOCIAL_BLOCKED_TEXT = "Für dieses Konto ist die Zwei-Faktor-Anmeldung aktiv. Bitte mit E-Mail, Passwort und Code anmelden.";

const MESSAGES: Record<string, string> = {
  ACCESS_DENIED: ACCESS_DENIED_TEXT,
  ACCESS_REVOKED: "Deine Adresse ist nicht mehr freigegeben. Die Sitzung wurde beendet.",
  SOCIAL_BLOCKED_2FA: SOCIAL_BLOCKED_TEXT,
  access_denied: "Die Anmeldung bei Discord wurde abgebrochen.",
  state_not_found: "Die Anmeldung ist abgelaufen. Bitte noch einmal versuchen.",
  state_mismatch: "Die Anmeldung ist abgelaufen. Bitte noch einmal versuchen.",
  invalid_callback_request: "Die Anmeldung ist abgelaufen. Bitte noch einmal versuchen.",
  unable_to_create_user: "Für diese Discord-Adresse besteht kein Zugang.",
  signup_disabled: "Für diese Discord-Adresse besteht kein Zugang.",
  account_not_linked: "Dieses Discord-Konto ist nicht mit deinem Zugang verknüpft. Bitte mit E-Mail und Passwort anmelden.",
  unable_to_link_account: "Dieses Discord-Konto ist nicht mit deinem Zugang verknüpft. Bitte mit E-Mail und Passwort anmelden.",
  email_not_verified: "Die E-Mail-Adresse bei Discord ist nicht bestätigt.",
  unable_to_create_session: "Die Anmeldung wurde abgelehnt.",
};

export function signInErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return MESSAGES[code] ?? "Die Anmeldung hat nicht geklappt. Bitte noch einmal versuchen.";
}
