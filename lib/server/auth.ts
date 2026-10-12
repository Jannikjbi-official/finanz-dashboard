import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { db } from "./db";
import { ensureUserSetup } from "./user-data";

const discordId = process.env.DISCORD_CLIENT_ID;
const discordSecret = process.env.DISCORD_CLIENT_SECRET;

/**
 * Private Anwendung: Registrieren und Anmelden duerfen nur die Adressen aus
 * ALLOWED_EMAILS. Ist die Liste leer, kann sich niemand neu registrieren.
 */
export function allowedEmails() {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(email: string) {
  return allowedEmails().includes(email.trim().toLowerCase());
}

export const auth = betterAuth({
  appName: "Jannikjbi Finanzen",
  database: mongodbAdapter(db),
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
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
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  // In MongoDB, damit das Limit auch ueber Serverless-Instanzen gilt
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60 * 60, max: 5 },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!isAllowedEmail(user.email)) {
            throw new APIError("FORBIDDEN", { message: "Diese Adresse ist für diese Anwendung nicht freigeschaltet." });
          }
          return { data: user };
        },
        after: async (user) => {
          await ensureUserSetup(user.id);
        },
      },
    },
  },
});

export const discordEnabled = Boolean(discordId && discordSecret);
