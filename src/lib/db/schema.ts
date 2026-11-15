import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ──────────────────────────────────────────────────────────────────────────
 * Better Auth (Nutzer, Sessions, Konten, Verifizierung, Rate-Limit)
 * Feldnamen müssen den Better-Auth-Feldnamen entsprechen.
 * ────────────────────────────────────────────────────────────────────────── */

export const user = pgTable("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text().primaryKey(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const rateLimit = pgTable("rate_limit", {
  id: text().primaryKey(),
  key: text().notNull().unique(),
  count: integer().notNull(),
  lastRequest: bigint({ mode: "number" }).notNull(),
});

/**
 * Login-Übergabe für die installierte App (PWA): Auf iPhone/Android läuft der
 * Discord-Login teils in einem separaten Browser-Fenster ohne gemeinsame
 * Cookies. Die App pollt mit einem nur ihr bekannten Geheimnis, bis der
 * Login im anderen Fenster abgeschlossen wurde, und erhält dann eine eigene
 * Session.
 */
export const loginHandoff = pgTable("login_handoff", {
  id: text().primaryKey(),
  secretHash: text().notNull(),
  userId: text().references(() => user.id, { onDelete: "cascade" }),
  completedAt: timestamp({ withTimezone: true }),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/* ──────────────────────────────────────────────────────────────────────────
 * Finanzdaten – alle Beträge als Cent-Integer
 * ────────────────────────────────────────────────────────────────────────── */

export const paymentMethod = pgEnum("payment_method", ["bar", "karte", "paypal", "ueberweisung"]);
export const billingInterval = pgEnum("billing_interval", [
  "woechentlich",
  "monatlich",
  "vierteljaehrlich",
  "jaehrlich",
]);
export const subscriptionStatus = pgEnum("subscription_status", ["aktiv", "pausiert", "gekuendigt"]);
export const wishPriority = pgEnum("wish_priority", ["hoch", "mittel", "niedrig"]);
export const recurringKind = pgEnum("recurring_kind", ["ausgabe", "einnahme"]);

export const category = pgTable(
  "category",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    color: text().notNull(),
    icon: text().notNull(),
    /** Monatsbudget in Cent, null = kein Budget */
    budgetCents: integer(),
    sortOrder: smallint().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("category_name_uq").on(sql`lower(${t.name})`)],
);

/** Vorlage für wiederkehrende Ausgaben/Einnahmen; erzeugt fällige Buchungen. */
export const recurringRule = pgTable("recurring_rule", {
  id: uuid().primaryKey().defaultRandom(),
  kind: recurringKind().notNull(),
  amountCents: integer().notNull(),
  interval: billingInterval().notNull(),
  categoryId: uuid().references(() => category.id, { onDelete: "set null" }),
  source: text(),
  paymentMethod: paymentMethod(),
  note: text(),
  /** Nächstes Datum, an dem eine Buchung erzeugt wird */
  nextDate: date({ mode: "string" }).notNull(),
  /** Ursprünglicher Tag im Monat – verhindert Verrutschen nach kurzen Monaten */
  anchorDay: smallint().notNull(),
  active: boolean().notNull().default(true),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const expense = pgTable(
  "expense",
  {
    id: uuid().primaryKey().defaultRandom(),
    amountCents: integer().notNull(),
    categoryId: uuid().references(() => category.id, { onDelete: "set null" }),
    date: date({ mode: "string" }).notNull(),
    paymentMethod: paymentMethod().notNull().default("karte"),
    note: text(),
    recurringId: uuid().references(() => recurringRule.id, { onDelete: "set null" }),
    /** Vom Gerät erzeugte ID – verhindert Doppelbuchungen bei Offline-Sync */
    clientId: uuid().unique(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("expense_date_idx").on(t.date), index("expense_category_idx").on(t.categoryId)],
);

export const income = pgTable(
  "income",
  {
    id: uuid().primaryKey().defaultRandom(),
    amountCents: integer().notNull(),
    source: text().notNull(),
    date: date({ mode: "string" }).notNull(),
    note: text(),
    recurringId: uuid().references(() => recurringRule.id, { onDelete: "set null" }),
    clientId: uuid().unique(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("income_date_idx").on(t.date)],
);

export const subscription = pgTable("subscription", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  priceCents: integer().notNull(),
  interval: billingInterval().notNull(),
  /** Abbuchungstag im Monat (1–31, wird bei kürzeren Monaten auf das Monatsende gelegt) */
  billingDay: smallint().notNull(),
  categoryId: uuid().references(() => category.id, { onDelete: "set null" }),
  startDate: date({ mode: "string" }).notNull(),
  cancellationDeadline: date({ mode: "string" }),
  note: text(),
  status: subscriptionStatus().notNull().default("aktiv"),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const wish = pgTable("wish", {
  id: uuid().primaryKey().defaultRandom(),
  title: text().notNull(),
  priceCents: integer().notNull(),
  url: text(),
  imageUrl: text(),
  priority: wishPriority().notNull().default("mittel"),
  note: text(),
  savedCents: integer().notNull().default(0),
  purchasedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** Einfache Schlüssel/Wert-Einstellungen (z. B. Akzentfarbe, Startguthaben). */
export const appSetting = pgTable("app_setting", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type Category = typeof category.$inferSelect;
export type Expense = typeof expense.$inferSelect;
export type Income = typeof income.$inferSelect;
export type Subscription = typeof subscription.$inferSelect;
export type Wish = typeof wish.$inferSelect;
export type RecurringRule = typeof recurringRule.$inferSelect;
export type PaymentMethod = (typeof paymentMethod.enumValues)[number];
export type BillingInterval = (typeof billingInterval.enumValues)[number];
export type SubscriptionStatus = (typeof subscriptionStatus.enumValues)[number];
export type WishPriority = (typeof wishPriority.enumValues)[number];
