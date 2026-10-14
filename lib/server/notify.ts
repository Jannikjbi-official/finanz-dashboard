import "server-only";
import { dueMessage, dueNotices, monthlyReview } from "../domain/notices";
import { loadFinanceData } from "./data";
import { db, settings } from "./db";

/**
 * Discord-Benachrichtigungen: Webhook pro Nutzer (Einstellungen), damit die
 * Zahlen eines Nutzers nur in seinem eigenen Kanal landen. Jede Meldung geht
 * genau einmal raus (Collection "notifications").
 */

export const DISCORD_WEBHOOK = /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;

export type NotifySettings = { webhookUrl: string | null; due: boolean; monthly: boolean };

export async function getNotifySettings(userId: string): Promise<NotifySettings> {
  const doc = await settings.findOne({ _id: userId }, { projection: { discordWebhookUrl: 1, notifyDue: 1, notifyMonthly: 1 } });
  const url = typeof doc?.discordWebhookUrl === "string" && DISCORD_WEBHOOK.test(doc.discordWebhookUrl) ? doc.discordWebhookUrl : null;
  return { webhookUrl: url, due: doc?.notifyDue !== false, monthly: doc?.notifyMonthly !== false };
}

/** Webhook gekuerzt fuer die Anzeige - die volle Adresse geht nie an den Browser. */
export function maskWebhook(url: string | null) {
  if (!url) return null;
  const id = url.split("/webhooks/")[1]?.split("/")[0] ?? "";
  return `discord.com/api/webhooks/${id.slice(0, 4)}…`;
}

type Fetch = typeof fetch;

export async function sendDiscord(url: string, content: string, fetchImpl: Fetch = fetch) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // Keine @-Erwaehnungen, egal was in Bezeichnungen steht
    body: JSON.stringify({ content: content.slice(0, 1900), allowed_mentions: { parse: [] } }),
  });
  return response.ok;
}

const sent = () => db.collection<{ _id: string; userId: string; sentAt: Date }>("notifications");

/** Taeglich aus dem Cron: neue Faelligkeiten und (am Monatsanfang) der Rueckblick. */
export async function runNotifications(fetchImpl: Fetch = fetch): Promise<number> {
  const users = await settings.find({ discordWebhookUrl: { $type: "string" } }, { projection: { _id: 1 } }).toArray();
  let messages = 0;

  for (const { _id: userId } of users) {
    const options = await getNotifySettings(userId);
    if (!options.webhookUrl) continue;
    const data = await loadFinanceData(userId);
    const parts: string[] = [];
    const keys: string[] = [];

    if (options.due) {
      const notices = dueNotices(data.recurring, data.today);
      const known = new Set((await sent().find({ _id: { $in: notices.map((n) => `${userId}:due:${n.key}`) } }).toArray()).map((doc) => doc._id));
      const fresh = notices.filter((notice) => !known.has(`${userId}:due:${notice.key}`));
      if (fresh.length) {
        parts.push(dueMessage(fresh));
        keys.push(...fresh.map((notice) => `${userId}:due:${notice.key}`));
      }
    }
    if (options.monthly && Number(data.today.slice(8, 10)) <= 3) {
      const review = monthlyReview(data.transactions, data.today);
      const key = review ? `${userId}:monthly:${review.month}` : null;
      if (review && key && !(await sent().findOne({ _id: key }))) {
        parts.push(review.text);
        keys.push(key);
      }
    }
    if (parts.length === 0) continue;

    if (await sendDiscord(options.webhookUrl, parts.join("\n\n"), fetchImpl)) {
      const now = new Date();
      await sent().insertMany(keys.map((key) => ({ _id: key, userId, sentAt: now })), { ordered: false }).catch(() => undefined);
      messages += 1;
    }
  }
  return messages;
}
