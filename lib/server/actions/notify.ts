"use server";

import { z } from "zod";
import { dueMessage, dueNotices } from "../../domain/notices";
import { loadFinanceData } from "../data";
import { settings } from "../db";
import { DISCORD_WEBHOOK, getNotifySettings, sendDiscord } from "../notify";
import { authorize, fail, firstIssue, ok, refresh, type ActionResult } from "./shared";

const notifySchema = z.object({
  /** undefined = unveraendert, "" = entfernen. */
  webhookUrl: z
    .string()
    .trim()
    .optional()
    .refine((value) => value === undefined || value === "" || DISCORD_WEBHOOK.test(value), "Bitte eine Discord-Webhook-Adresse (https://discord.com/api/webhooks/…) angeben"),
  due: z.boolean(),
  monthly: z.boolean(),
});

export type NotifyInput = z.input<typeof notifySchema>;

export async function saveNotificationSettings(input: NotifyInput): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const parsed = notifySchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { webhookUrl, due, monthly } = parsed.data;

  const set: Record<string, unknown> = { notifyDue: due, notifyMonthly: monthly, updatedAt: new Date() };
  if (webhookUrl) set.discordWebhookUrl = webhookUrl;
  const update = webhookUrl === "" ? { $set: set, $unset: { discordWebhookUrl: "" as const } } : { $set: set };
  await settings.updateOne({ _id: auth.userId }, update, { upsert: true });
  refresh();
  return ok(webhookUrl === "" ? "Discord-Benachrichtigungen entfernt" : "Benachrichtigungen gespeichert");
}

/** Probe: schickt die aktuellen Faelligkeiten (oder einen Hinweis) sofort. */
export async function sendTestNotification(): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const options = await getNotifySettings(auth.userId);
  if (!options.webhookUrl) return fail("Erst eine Webhook-Adresse speichern");
  const data = await loadFinanceData(auth.userId);
  const notices = dueNotices(data.recurring, data.today);
  const text = `Testnachricht aus Jannikjbi Finanzen\n\n${notices.length ? dueMessage(notices) : "Gerade ist nichts fällig."}`;
  try {
    return (await sendDiscord(options.webhookUrl, text)) ? ok("Testnachricht gesendet") : fail("Discord hat die Nachricht abgelehnt – stimmt die Webhook-Adresse?");
  } catch {
    return fail("Discord ist gerade nicht erreichbar");
  }
}
