/**
 * Adresse, unter der Better Auth laeuft.
 *
 * Vercel-Previews laufen unter eigenen *.vercel.app-Adressen. Dort gilt die
 * Adresse des Previews statt BETTER_AUTH_URL (die auf die Live-Domain zeigt),
 * sonst lehnt Better Auth jede Anmeldung mit "Invalid origin" ab. Die
 * VERCEL_*-Variablen setzt Vercel selbst. In Production gilt BETTER_AUTH_URL;
 * fehlt sie, die Produktionsdomain, die Vercel mitliefert
 * (VERCEL_PROJECT_PRODUCTION_URL). Lokal: localhost.
 */
export function resolveAuthUrls(env: Record<string, string | undefined> = process.env) {
  const configured =
    env.BETTER_AUTH_URL?.trim().replace(/\/+$/, "") ||
    (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
  if (env.VERCEL_ENV !== "preview") return { baseURL: configured, trustedOrigins: [] as string[] };

  const hosts = [env.VERCEL_BRANCH_URL, env.VERCEL_URL].filter((host): host is string => Boolean(host));
  const origins = [...new Set(hosts.map((host) => `https://${host}`))];
  return { baseURL: origins[0] ?? configured, trustedOrigins: origins };
}
