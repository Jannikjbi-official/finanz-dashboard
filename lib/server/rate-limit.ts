import "server-only";
import { db } from "../mongo";

type Bucket = { _id: string; count: number; resetAt: Date };

const buckets = db.collection<Bucket>("rate_limits");
let indexReady: Promise<unknown> | null = null;

/**
 * Fester Zeitfenster-Zaehler in MongoDB - funktioniert auch auf Vercel, wo
 * jeder Request in einer anderen Instanz landen kann. Abgelaufene Eintraege
 * raeumt ein TTL-Index weg.
 */
export async function hitRateLimit(key: string, limit: number, windowSeconds: number) {
  indexReady ??= buckets
    .createIndex({ resetAt: 1 }, { expireAfterSeconds: 0 })
    .catch(() => (indexReady = null));
  await indexReady;

  const now = new Date();
  const expired = { $or: [{ $not: ["$resetAt"] }, { $lte: ["$resetAt", now] }] };

  const bucket = await buckets.findOneAndUpdate(
    { _id: key },
    [
      {
        // Beide Ausdruecke sehen den alten Stand des Dokuments
        $set: {
          count: { $cond: [expired, 1, { $add: ["$count", 1] }] },
          resetAt: {
            $cond: [expired, new Date(now.getTime() + windowSeconds * 1000), "$resetAt"],
          },
        },
      },
    ],
    { upsert: true, returnDocument: "after" },
  );

  const count = bucket?.count ?? 1;
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: bucket
      ? Math.max(0, Math.ceil((bucket.resetAt.getTime() - now.getTime()) / 1000))
      : windowSeconds,
  };
}

/** Grenzen fuer schreibende Aktionen pro Nutzer. */
export const LIMITS = {
  write: { limit: 120, window: 60 },
  import: { limit: 10, window: 60 * 60 },
  export: { limit: 20, window: 60 * 60 },
} as const;

export async function limitUser(userId: string, kind: keyof typeof LIMITS) {
  const { limit, window } = LIMITS[kind];
  return hitRateLimit(`${kind}:${userId}`, limit, window);
}
