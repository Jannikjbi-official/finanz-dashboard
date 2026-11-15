import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  EMERGENCY_MAX_ATTEMPTS,
  EMERGENCY_WINDOW_SECONDS,
  SESSION_DAYS,
  allowedDiscordId,
  appBaseUrl,
  discordEmail,
  isAllowedEmail,
} from "./config";
import { finanzenAuthPlugin } from "./plugin";

interface DiscordProfile {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  discriminator: string;
}

function discordAvatar(p: DiscordProfile): string {
  if (!p.avatar) {
    const index = Number((BigInt(p.id) >> BigInt(22)) % BigInt(6));
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }
  const ext = p.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.${ext}?size=128`;
}

const baseURL = appBaseUrl();
const isProduction = process.env.NODE_ENV === "production";

export const auth = betterAuth({
  appName: "Finanzen",
  baseURL,
  secret: process.env.AUTH_SECRET,
  trustedOrigins: [baseURL],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      rateLimit: schema.rateLimit,
    },
  }),
  emailAndPassword: { enabled: false },
  socialProviders: {
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID ?? "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? "",
      // Nur "identify" – keine E-Mail, keine Server-Liste.
      disableDefaultScope: true,
      scope: ["identify"],
      async getUserInfo(token) {
        const res = await fetch("https://discord.com/api/users/@me", {
          headers: { authorization: `Bearer ${token.accessToken}` },
          cache: "no-store",
        });
        if (!res.ok) return null;
        const profile = (await res.json()) as DiscordProfile;

        // ALLOWLIST: Jede andere ID wird sofort abgewiesen – bevor ein Nutzer
        // oder eine Session angelegt wird.
        if (!profile.id || profile.id !== allowedDiscordId()) {
          throw new APIError("FOUND", undefined, new Headers({ Location: `${baseURL}/kein-zugriff` }));
        }

        return {
          user: {
            name: profile.global_name || profile.username,
            email: discordEmail(profile.id),
            emailVerified: true,
            image: discordAvatar(profile),
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: profile as any,
        };
      },
    },
  },
  account: {
    // Für die installierte App: Callback kann in einem separaten
    // Browserfenster landen (anderer Cookie-Speicher). Der State wird
    // weiterhin serverseitig in der Datenbank geprüft.
    skipStateCookieCheck: true,
    storeStateStrategy: "database",
    accountLinking: { enabled: false },
  },
  session: {
    expiresIn: 60 * 60 * 24 * SESSION_DAYS,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/emergency/sign-in": { window: EMERGENCY_WINDOW_SECONDS, max: EMERGENCY_MAX_ATTEMPTS },
      "/handoff/start": { window: 600, max: 15 },
      "/handoff/poll": { window: 60, max: 60 },
    },
  },
  advanced: {
    useSecureCookies: isProduction,
    cookiePrefix: "finanzen",
    defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure: isProduction },
    ipAddress: { ipAddressHeaders: ["x-real-ip", "x-forwarded-for"] },
  },
  databaseHooks: {
    user: {
      create: {
        // Zweite Sicherung: Nur der erlaubte Discord-Account darf angelegt werden.
        before: async (u) => (isAllowedEmail(u.email) ? { data: u } : false),
      },
      update: {
        before: async (u) => {
          // E-Mail (= Discord-ID) darf sich nie ändern.
          const { email: _ignored, ...rest } = u;
          return { data: rest };
        },
      },
    },
    session: {
      create: {
        before: async (s) => {
          const [owner] = await db
            .select({ email: schema.user.email })
            .from(schema.user)
            .where(eq(schema.user.id, s.userId))
            .limit(1);
          return owner && isAllowedEmail(owner.email) ? { data: s } : false;
        },
      },
    },
  },
  plugins: [finanzenAuthPlugin(), nextCookies()],
  telemetry: { enabled: false },
});

export type Session = typeof auth.$Infer.Session;
