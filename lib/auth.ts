import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { db } from "./mongo";
import { seedDefaultCategories } from "./seed";
import { mayRegister } from "./server/beta";
import { deleteUserData, ensureSettings } from "./server/user-data";
import { BRAND } from "./brand";

const discordId = process.env.DISCORD_CLIENT_ID;
const discordSecret = process.env.DISCORD_CLIENT_SECRET;

export const auth = betterAuth({
  appName: BRAND.name,
  database: mongodbAdapter(db),
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
  },
  socialProviders:
    discordId && discordSecret
      ? { discord: { clientId: discordId, clientSecret: discordSecret } }
      : {},
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["discord"],
      // Ausdruecklich: nur Konten mit bestaetigter Adresse werden verknuepft.
      // Sonst koennte ein vorab angelegtes Fremdkonto uebernommen werden.
      requireLocalEmailVerified: true,
    },
  },
  user: {
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        await deleteUserData(user.id);
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  // In MongoDB gespeichert, damit das Limit auch ueber Serverless-Instanzen gilt
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60 * 60, max: 5 },
      "/delete-user": { window: 60 * 60, max: 3 },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!(await mayRegister(user.email))) {
            throw new APIError("FORBIDDEN", {
              message:
                "Die Registrierung ist im Moment nur mit Einladung möglich.",
            });
          }
          return { data: user };
        },
        after: async (user) => {
          await ensureSettings(user.id);
          await seedDefaultCategories(user.id);
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export const discordEnabled = Boolean(discordId && discordSecret);
