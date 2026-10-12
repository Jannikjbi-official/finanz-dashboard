import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { twoFactor } from "better-auth/plugins/two-factor";
import { dash } from "@better-auth/infra";
import { ACCESS_DENIED, isAllowedEmail, sessionRejection } from "./access";
import { resolveAuthUrls } from "./auth-urls";
import { db, toObjectId } from "./db";
import { ensureUserSetup } from "./user-data";

const discordId = process.env.DISCORD_CLIENT_ID;
const discordSecret = process.env.DISCORD_CLIENT_SECRET;

const DAY = 60 * 60 * 24;

const urls = resolveAuthUrls();

/**
 * Better-Auth-Dashboard (dash.better-auth.com): nur aktiv, wenn
 * BETTER_AUTH_API_KEY gesetzt ist. Anfragen des Dashboards sind ueber
 * signierte Tokens von Better Auth abgesichert; Freigabeliste und
 * Sitzungspruefung unten gelten auch fuer alles, was darueber angelegt wird.
 */
const dashboard = process.env.BETTER_AUTH_API_KEY?.trim() ? [dash()] : [];

export const auth = betterAuth({
  appName: "Jannikjbi Finanzen",
  database: mongodbAdapter(db),
  baseURL: urls.baseURL,
  trustedOrigins: urls.trustedOrigins,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    // Nach einer Passwortaenderung per Reset alle Sitzungen beenden
    revokeSessionsOnPasswordReset: true,
  },
  socialProviders: discordId && discordSecret ? { discord: { clientId: discordId, clientSecret: discordSecret } } : {},
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["discord"],
      // Nur Konten mit bestaetigter Adresse verknuepfen
      requireLocalEmailVerified: true,
    },
  },
  plugins: [
    twoFactor({
      issuer: "Jannikjbi Finanzen",
      // "Diesem Geraet vertrauen" gilt 30 Tage
      trustDeviceMaxAge: 30 * DAY,
      backupCodeOptions: { amount: 10, length: 10 },
    }),
    ...dashboard,
  ],
  session: {
    // Kuerzer als frueher: nach 7 Tagen ohne Nutzung neu anmelden
    expiresIn: 7 * DAY,
    updateAge: DAY,
    // Beendete Sitzungen gelten spaetestens nach einer Minute nicht mehr
    cookieCache: { enabled: true, maxAge: 60 },
  },
  // In MongoDB gespeichert, damit das Limit auch ueber Serverless-Instanzen gilt
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 15 * 60, max: 10 },
      "/sign-up/email": { window: 60 * 60, max: 5 },
      "/change-password": { window: 60 * 60, max: 5 },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!isAllowedEmail(user.email)) throw new APIError("FORBIDDEN", { message: ACCESS_DENIED });
          return { data: user };
        },
        after: async (user) => {
          await ensureUserSetup(user.id);
        },
      },
    },
    session: {
      create: {
        // Jede neue Sitzung wird geprueft - egal ueber welchen Weg sie entsteht
        before: async (session, context) => {
          const user = context
            ? await context.context.internalAdapter.findUserById(session.userId)
            : await db.collection("user").findOne({ _id: toObjectId(session.userId) ?? undefined });
          const reason = sessionRejection({
            email: user?.email,
            twoFactorEnabled: (user as { twoFactorEnabled?: boolean } | null)?.twoFactorEnabled,
            path: context?.path,
          });
          if (reason) throw new APIError("FORBIDDEN", { message: reason });
          return { data: session };
        },
      },
    },
  },
});

export const discordEnabled = Boolean(discordId && discordSecret);
