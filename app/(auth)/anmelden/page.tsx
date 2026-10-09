import Link from "next/link";
import { redirect } from "next/navigation";
import { discordEnabled } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";
import { SignInForm } from "@/features/site/auth-forms";

export const metadata = { title: "Anmelden" };

export default async function AnmeldenPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  if (await getCurrentUser()) redirect("/app");

  return (
    <>
      <h1 className="font-serif text-[34px] leading-tight">Anmelden</h1>
      <p className="mt-2 text-[15px] text-ink-2">Willkommen zurück.</p>
      <div className="mt-8">
        <SignInForm next={params.next ?? null} discord={discordEnabled} />
      </div>
      <p className="mt-8 border-t border-line pt-5 text-[13px] text-ink-3">
        Noch kein Konto? Die Registrierung ist im Moment nur mit Einladung möglich.{" "}
        <Link href="/warteliste" className="text-accent hover:underline">
          Auf die Warteliste
        </Link>
      </p>
    </>
  );
}
