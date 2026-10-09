import "server-only";
import { db, settings, USER_DATA_COLLECTIONS, type UserSettingsDoc } from "../mongo";

/** Standard fuer neue Nutzer und Bestandsnutzer ohne Eintrag. */
export function defaultSettings(userId: string): UserSettingsDoc {
  const now = new Date();
  return {
    _id: userId,
    currency: "EUR",
    locale: "de-DE",
    timeZone: "Europe/Berlin",
    reserveCents: null,
    variableEstimateCents: null,
    onboardingCompletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getSettings(userId: string): Promise<UserSettingsDoc> {
  const existing = await settings.findOne({ _id: userId });
  return existing ?? defaultSettings(userId);
}

export async function ensureSettings(userId: string) {
  await settings.updateOne(
    { _id: userId },
    { $setOnInsert: defaultSettings(userId) },
    { upsert: true },
  );
}

/**
 * Vollstaendiger Export aller Daten eines Nutzers (DSGVO Art. 20).
 * Interne Felder wie userId werden weggelassen.
 */
export async function exportUserData(userId: string) {
  const result: Record<string, unknown[]> = {};

  for (const name of USER_DATA_COLLECTIONS) {
    const docs = await db
      .collection(name)
      .find({ userId }, { projection: { userId: 0 } })
      .toArray();
    result[name] = docs.map(({ _id, ...rest }) => ({ id: String(_id), ...rest }));
  }

  const ownSettings = await settings.findOne({ _id: userId }, { projection: { _id: 0 } });
  result.settings = ownSettings ? [ownSettings] : [];

  return result;
}

/**
 * Loescht saemtliche Finanzdaten eines Nutzers. Wird aufgerufen, bevor Better
 * Auth den Nutzer selbst samt Sessions und verknuepften Logins entfernt.
 */
export async function deleteUserData(userId: string) {
  const counts: Record<string, number> = {};

  for (const name of USER_DATA_COLLECTIONS) {
    const { deletedCount } = await db.collection(name).deleteMany({ userId });
    counts[name] = deletedCount;
  }

  await settings.deleteOne({ _id: userId });
  return counts;
}
