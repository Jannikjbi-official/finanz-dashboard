/** Klassen zusammensetzen, falsy-Werte fallen weg. */
export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
