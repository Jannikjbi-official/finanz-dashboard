"use client";

import { dashClient } from "@better-auth/infra/client";
import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

/**
 * Ohne feste Adresse: Der Client spricht immer mit der Seite, auf der er
 * laeuft - Live-Domain, Vercel-Preview oder localhost.
 *
 * dashClient (Better-Auth-Dashboard) ergaenzt nur Abfragen der Audit-Logs
 * ueber den eigenen Server. Seine Plugin-ID ist nur als string typisiert und
 * wuerde die Typen der uebrigen Plugins verwischen - deshalb bleibt die
 * Typisierung auf twoFactorClient, zur Laufzeit sind beide aktiv.
 */
const plugins = [twoFactorClient(), dashClient()] as unknown as [ReturnType<typeof twoFactorClient>];

export const authClient = createAuthClient({ plugins });
