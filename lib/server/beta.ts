import { db } from "../mongo";

/**
 * Closed Beta: Registrieren darf nur, wer freigeschaltet ist - entweder ueber
 * ALLOWED_EMAILS (Bootstrap, z. B. der Betreiber) oder ueber die Collection
 * "beta_invites" (npm run beta:invite -- adresse@example.org).
 *
 * BETA_OPEN=true hebt die Sperre auf, sobald die Plattform oeffentlich wird.
 */
export type BetaInviteDoc = {
  _id: string; // E-Mail in Kleinbuchstaben
  invitedAt: Date;
  note: string | null;
};

export const betaInvites = db.collection<BetaInviteDoc>("beta_invites");

function envList() {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function registrationOpen() {
  return process.env.BETA_OPEN === "true";
}

export async function mayRegister(email: string) {
  if (registrationOpen()) return true;

  const normalized = email.trim().toLowerCase();
  if (envList().includes(normalized)) return true;

  return (await betaInvites.countDocuments({ _id: normalized }, { limit: 1 })) > 0;
}
