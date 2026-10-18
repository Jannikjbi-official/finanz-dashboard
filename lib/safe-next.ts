/**
 * Ziel nach der Anmeldung: nur Pfade dieser App. "//x" und "/\x" deuten
 * Browser als fremde Adresse, Steuerzeichen werden teils entfernt - beides
 * waere eine offene Weiterleitung.
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || next.length > 500) return "/";
  if (!/^\/(?![/\\])/.test(next) || /[\u0000-\u001f\u007f]/.test(next)) return "/";
  return next;
}
