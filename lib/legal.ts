/**
 * Anbieterangaben fuer Impressum und Datenschutz aus der Umgebung
 * (LEGAL_NAME, LEGAL_STREET, LEGAL_CITY, LEGAL_EMAIL). Fehlt etwas, zeigen
 * die Seiten einen deutlichen Hinweis statt erfundener Angaben.
 */
export function operator(env: Record<string, string | undefined> = process.env) {
  const value = (key: string) => env[key]?.trim() || null;
  const data = { name: value("LEGAL_NAME"), street: value("LEGAL_STREET"), city: value("LEGAL_CITY"), email: value("LEGAL_EMAIL") };
  return { ...data, complete: Object.values(data).every(Boolean) };
}
