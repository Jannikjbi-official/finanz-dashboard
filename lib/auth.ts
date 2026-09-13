import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { dash } from "@better-auth/infra";
import { db } from "./mongo";
import { seedDefaultCategories } from "./seed";

/**
 * Nur die hier hinterlegten Mail-Adressen duerfen ueberhaupt einen Account
 * anlegen - egal ob per E-Mail/Passwort oder per Discord.
 */
const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

function isAllowed(email: string) {
  if (allowedEmails.length === 0) return false;
  return allowedEmails.includes(email.toLowerCase());
}

const discordId = process.env.DISCORD_CLIENT_ID;
const discordSecret = process.env.DISCORD_CLIENT_SECRET;

export const auth = betterAuth({
  appName: "Finanz Dashboard",
  database: mongodbAdapter(db),
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
  },
  socialProviders:
    discordId && discordSecret
      ? { discord: { clientId: discordId, clientSecret: discordSecret } }
      : {},
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["discord", "email-password"],
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  plugins: [dash()],
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!isAllowed(user.email)) {
            throw new APIError("FORBIDDEN", {
              message:
                "Dieser Account ist gesperrt. Nur freigeschaltete Adressen können sich registrieren.",
            });
          }
          return { data: user };
        },
        after: async (user) => {
          await seedDefaultCategories(user.id);
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export const discordEnabled = Boolean(discordId && discordSecret);
