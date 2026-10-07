"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { hitRateLimit } from "../rate-limit";
import { waitlist } from "../waitlist";

export type WaitlistState = { ok: boolean; error?: string; message?: string };

const schema = z.object({
  email: z.string().trim().toLowerCase().max(200).email("Bitte eine gültige E-Mail-Adresse eingeben"),
  name: z.string().trim().max(60).optional(),
  consent: z.literal("on", { message: "Bitte stimme der Speicherung zu" }),
});

/**
 * Eintrag auf die Warteliste. Antwortet immer gleich, egal ob die Adresse
 * schon eingetragen ist - so laesst sich nicht abfragen, wer auf der Liste steht.
 */
export async function joinWaitlist(_prev: WaitlistState, formData: FormData): Promise<WaitlistState> {
  // Honeypot: echte Menschen sehen dieses Feld nicht
  if (String(formData.get("website") ?? "").trim()) {
    return { ok: true, message: "Danke! Wir melden uns, sobald ein Platz frei ist." };
  }

  const requestHeaders = await headers();
  const ip = (requestHeaders.get("x-forwarded-for") ?? "").split(",")[0].trim() || requestHeaders.get("x-real-ip") || "unknown";
  const limit = await hitRateLimit(`waitlist:${ip}`, 5, 60 * 60);
  if (!limit.allowed) return { ok: false, error: "Zu viele Versuche – bitte später noch einmal." };

  const parsed = schema.safeParse({
    email: formData.get("email"),
    name: formData.get("name") || undefined,
    consent: formData.get("consent"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Eingabe prüfen" };

  const now = new Date();
  await waitlist.updateOne(
    { _id: parsed.data.email },
    { $setOnInsert: { name: parsed.data.name || null, consentAt: now, createdAt: now } },
    { upsert: true },
  );

  return { ok: true, message: "Danke! Du stehst auf der Warteliste. Wir melden uns, sobald ein Platz frei ist." };
}
