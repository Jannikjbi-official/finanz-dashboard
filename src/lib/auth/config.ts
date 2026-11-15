/** Gemeinsame Auth-Konstanten (Server, Proxy, Client-sicher). */

export const SESSION_DAYS = 30;
export const EMERGENCY_WINDOW_SECONDS = 15 * 60;
export const EMERGENCY_MAX_ATTEMPTS = 5;

/** Synthetische E-Mail – Discord liefert mit Scope "identify" keine E-Mail. */
export function discordEmail(discordId: string): string {
  return `${discordId}@discord.invalid`;
}

export function allowedDiscordId(): string | null {
  const id = process.env.ALLOWED_DISCORD_ID?.trim();
  return id && /^\d{5,25}$/.test(id) ? id : null;
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  const id = allowedDiscordId();
  return !!id && !!email && email.toLowerCase() === discordEmail(id);
}

/** Öffentliche Basis-URL der App. */
export function appBaseUrl(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL.replace(/\/$/, "");
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
