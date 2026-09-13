"use client";

import { createAuthClient } from "better-auth/react";
import { sentinelClient } from "@better-auth/infra/client";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? undefined,
  plugins: [sentinelClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
