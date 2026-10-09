import "server-only";

/**
 * Anbieterangaben fuer Impressum und Datenschutzerklaerung. Kommen aus der
 * Umgebung, damit keine erfundenen Daten im Code stehen.
 */
export function operator() {
  const name = process.env.LEGAL_NAME?.trim() || null;
  const street = process.env.LEGAL_STREET?.trim() || null;
  const city = process.env.LEGAL_CITY?.trim() || null;
  const email = process.env.LEGAL_EMAIL?.trim() || null;
  return { name, street, city, email, complete: Boolean(name && street && city && email) };
}

/** Erst auf true setzen, wenn Impressum und Datenschutz rechtlich geprueft sind. */
export function legalReviewed() {
  return process.env.LEGAL_REVIEWED === "true";
}
