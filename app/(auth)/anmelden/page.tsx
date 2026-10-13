import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { signInErrorMessage } from "@/lib/auth-errors";
import { accessConfigured, registrationOpen } from "@/lib/server/access";
import { discordEnabled } from "@/lib/server/auth";
import { getCurrentUser } from "@/lib/server/session";

export const metadata = { title: "Anmelden" };
export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { next, error } = await searchParams;
  // Nur interne Pfade als Ziel zulassen
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return (
    <AuthForm
      mode="sign-in"
      next={target}
      discord={discordEnabled}
      canRegister={await registrationOpen()}
      locked={!accessConfigured()}
      initialError={signInErrorMessage(typeof error === "string" ? error : null)}
    />
  );
}
