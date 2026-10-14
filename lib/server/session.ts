import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAllowedEmail } from "./access";
import { auth } from "./auth";

/**
 * Angemeldeter Nutzer - aber nur, wenn seine Adresse (weiterhin) freigegeben
 * ist. Wird eine Adresse aus ALLOWED_EMAILS entfernt, verliert sie sofort
 * den Zugriff, auch mit noch gueltiger Sitzung.
 */
export async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !isAllowedEmail(session.user.email)) return null;
  return session.user;
}

/**
 * Fuer Seiten: ohne gueltige, freigegebene Sitzung zur Anmeldung. Wurde die
 * Adresse inzwischen aus der Freigabeliste entfernt, erklaert die
 * Anmeldeseite das, statt stumm umzuleiten.
 */
export async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/anmelden");
  if (!isAllowedEmail(session.user.email)) redirect("/anmelden?error=ACCESS_REVOKED");
  return session.user;
}
