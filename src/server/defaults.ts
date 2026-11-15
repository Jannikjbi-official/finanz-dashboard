import "server-only";
import { sql } from "drizzle-orm";
import { cache } from "react";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { db } from "@/lib/db";
import { category } from "@/lib/db/schema";

/** Legt beim allerersten Start die Standard-Kategorien an. */
export const ensureDefaultCategories = cache(async () => {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(category);
  if ((row?.n ?? 0) > 0) return;
  await db
    .insert(category)
    .values(DEFAULT_CATEGORIES.map((c, i) => ({ ...c, sortOrder: i })))
    .onConflictDoNothing();
});
