import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/lib/db";
import { loginHandoff, user } from "@/lib/db/schema";
import { allowedDiscordId, discordEmail } from "./config";

const HANDOFF_TTL_MS = 10 * 60 * 1000;

let dummyHash: string | null = null;
/** Gültiger Hash für Vergleiche ohne konfiguriertes Passwort (gleiche Laufzeit). */
function getDummyHash(): string {
  dummyHash ??= bcrypt.hashSync(randomBytes(16).toString("hex"), 12);
  return dummyHash;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Den einzigen erlaubten Nutzer finden (oder für den Notfall-Login anlegen). */
async function ensureOwner() {
  const discordId = allowedDiscordId();
  if (!discordId) return null;
  const email = discordEmail(discordId);
  const [existing] = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(user)
    .values({ id: randomBytes(16).toString("hex"), name: "Notfall-Zugang", email, emailVerified: false })
    .returning();
  return created ?? null;
}

/**
 * Eigene Endpunkte:
 *  - POST /api/auth/emergency/sign-in  – Notfall-Login per Passwort (bcrypt-Hash aus ENV)
 *  - POST /api/auth/handoff/start      – PWA startet Login-Übergabe
 *  - POST /api/auth/handoff/complete   – Browserfenster mit Session bestätigt Übergabe
 *  - POST /api/auth/handoff/poll       – PWA holt sich ihre eigene Session ab
 */
export const finanzenAuthPlugin = () =>
  ({
    id: "finanzen",
    endpoints: {
      emergencySignIn: createAuthEndpoint(
        "/emergency/sign-in",
        { method: "POST", body: z.object({ password: z.string().min(1).max(256) }) },
        async (ctx) => {
          const hash = process.env.EMERGENCY_PASSWORD_HASH?.trim();
          // Immer vergleichen (auch ohne Hash), damit die Antwortzeit nichts verrät.
          const ok = await bcrypt.compare(
            ctx.body.password,
            hash && hash.startsWith("$2") ? hash : getDummyHash(),
          );
          if (!hash || !ok) {
            throw new APIError("UNAUTHORIZED", { message: "Passwort falsch." });
          }
          const owner = await ensureOwner();
          if (!owner) throw new APIError("FORBIDDEN", { message: "ALLOWED_DISCORD_ID ist nicht gesetzt." });
          const session = await ctx.context.internalAdapter.createSession(owner.id);
          if (!session) throw new APIError("INTERNAL_SERVER_ERROR", { message: "Session fehlgeschlagen." });
          await setSessionCookie(ctx, { session, user: owner });
          return ctx.json({ ok: true });
        },
      ),

      handoffStart: createAuthEndpoint("/handoff/start", { method: "POST" }, async (ctx) => {
        const id = randomBytes(18).toString("base64url");
        const secret = randomBytes(32).toString("base64url");
        // Abgelaufene Übergaben aufräumen
        await db.delete(loginHandoff).where(lt(loginHandoff.expiresAt, new Date()));
        await db.insert(loginHandoff).values({
          id,
          secretHash: sha256(secret),
          expiresAt: new Date(Date.now() + HANDOFF_TTL_MS),
        });
        return ctx.json({ code: id, secret });
      }),

      handoffComplete: createAuthEndpoint(
        "/handoff/complete",
        { method: "POST", body: z.object({ code: z.string().min(10).max(64) }), use: [sessionMiddleware] },
        async (ctx) => {
          const result = await db
            .update(loginHandoff)
            .set({ userId: ctx.context.session.user.id, completedAt: new Date() })
            .where(
              and(
                eq(loginHandoff.id, ctx.body.code),
                isNull(loginHandoff.completedAt),
                gt(loginHandoff.expiresAt, new Date()),
              ),
            )
            .returning({ id: loginHandoff.id });
          return ctx.json({ ok: result.length > 0 });
        },
      ),

      handoffPoll: createAuthEndpoint(
        "/handoff/poll",
        {
          method: "POST",
          body: z.object({ code: z.string().min(10).max(64), secret: z.string().min(10).max(128) }),
        },
        async (ctx) => {
          const [row] = await db.select().from(loginHandoff).where(eq(loginHandoff.id, ctx.body.code)).limit(1);
          if (!row || row.expiresAt < new Date() || !safeEqualHex(row.secretHash, sha256(ctx.body.secret))) {
            return ctx.json({ status: "expired" as const });
          }
          if (!row.completedAt || !row.userId) return ctx.json({ status: "pending" as const });

          // Einmalig verwenden
          const deleted = await db.delete(loginHandoff).where(eq(loginHandoff.id, row.id)).returning();
          if (deleted.length === 0) return ctx.json({ status: "expired" as const });

          const [owner] = await db.select().from(user).where(eq(user.id, row.userId)).limit(1);
          if (!owner) return ctx.json({ status: "expired" as const });
          const session = await ctx.context.internalAdapter.createSession(owner.id);
          if (!session) throw new APIError("INTERNAL_SERVER_ERROR");
          await setSessionCookie(ctx, { session, user: owner });
          return ctx.json({ status: "done" as const });
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
