import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { discordEnabled } from "@/lib/server/auth";
import { getCurrentUser } from "@/lib/server/session";

export const metadata = { title: "Anmelden" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  // Nur interne Pfade als Ziel zulassen
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return <AuthForm mode="sign-in" next={target} discord={discordEnabled} />;
}
