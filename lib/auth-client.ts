"use client";

import { createAuthClient } from "better-auth/react";
import { sentinelClient } from "@better-auth/infra/client";

/**
 * Die Ingestion-URL läuft im Browser, deshalb muss sie als NEXT_PUBLIC-Variable
 * gesetzt sein - das Plugin selbst liest nur BETTER_AUTH_KV_URL, das im
 * Client-Bundle nicht ankommt.
 */
const identifyUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_IDENTIFY_URL?.trim();

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? undefined,
  plugins: [sentinelClient(identifyUrl ? { identifyUrl } : undefined)],
});

export const { signIn, signUp, signOut, useSession } = authClient;
