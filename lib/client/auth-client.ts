"use client";

import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

/**
 * Ohne feste Adresse: Der Client spricht immer mit der Seite, auf der er
 * laeuft - Live-Domain, Vercel-Preview oder localhost.
 */
export const authClient = createAuthClient({
  plugins: [twoFactorClient()],
});
