import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginCard } from "@/components/auth/login-card";
import { getSession } from "@/lib/auth/session";
import { safeRedirect } from "@/lib/utils";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ weiter?: string; fehler?: string; error?: string }>;
}) {
  const params = await searchParams;
  const target = safeRedirect(params.weiter);
  if (await getSession()) redirect(target);
  return <LoginCard target={target} error={params.fehler ? (params.error ?? params.fehler) : null} />;
}
