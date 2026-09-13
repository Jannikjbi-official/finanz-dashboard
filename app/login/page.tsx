import { Suspense } from "react";
import { redirect } from "next/navigation";
import { discordEnabled } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "@/components/login-form";
import { LogoMark } from "@/components/logo";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <LogoMark size={56} id="login" className="mx-auto mb-4" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Finanz Dashboard
          </h1>
          <p className="mt-1 text-sm text-default-500">
            Privater Zugang &ndash; nur freigeschaltete Konten.
          </p>
        </div>

        <Suspense fallback={null}>
          <LoginForm discordEnabled={discordEnabled} />
        </Suspense>
      </div>
    </main>
  );
}
