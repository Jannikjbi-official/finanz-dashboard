import "server-only";
import { accounts, categories, goals, planned, recurring, toObjectId, transactions } from "../mongo";

const OWNED = { accounts, categories, goals, planned, recurring, transactions } as const;
export type OwnedCollection = keyof typeof OWNED;

/**
 * Prueft eine aus dem Formular uebernommene Referenz. Ergebnis:
 * - null, wenn bewusst nichts gewaehlt wurde
 * - die ID, wenn der Datensatz dem Nutzer gehoert
 * - false, wenn die ID fremd, ungueltig oder unbekannt ist
 *
 * So kann niemand Buchungen an Konten oder Kategorien anderer Nutzer haengen.
 */
export async function ownedRef(
  userId: string,
  collection: OwnedCollection,
  raw: FormDataEntryValue | string | null | undefined,
): Promise<string | null | false> {
  const value = String(raw ?? "").trim();
  if (!value || value === "none") return null;

  const objectId = toObjectId(value);
  if (!objectId) return false;

  // Die Collections haben unterschiedliche Dokumenttypen, gefiltert wird ueberall gleich
  const target = OWNED[collection] as unknown as typeof accounts;
  const found = await target.countDocuments({ _id: objectId, userId }, { limit: 1 });
  return found > 0 ? value : false;
}

/** Mehrere Referenzen auf einmal pruefen; liefert die erste fremde als Fehler. */
export async function ownedRefs<K extends string>(
  userId: string,
  refs: Record<K, { collection: OwnedCollection; raw: FormDataEntryValue | string | null | undefined }>,
): Promise<{ ok: true; values: Record<K, string | null> } | { ok: false; field: K }> {
  const values = {} as Record<K, string | null>;

  for (const key of Object.keys(refs) as K[]) {
    const result = await ownedRef(userId, refs[key].collection, refs[key].raw);
    if (result === false) return { ok: false, field: key };
    values[key] = result;
  }

  return { ok: true, values };
}
