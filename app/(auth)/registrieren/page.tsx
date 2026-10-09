import Link from "next/link";
import { redirect } from "next/navigation";
import { discordEnabled } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";
import { registrationOpen } from "@/lib/server/beta";
import { SignUpForm } from "@/features/site/auth-forms";
import { WaitlistForm } from "@/features/site/waitlist-form";

export const metadata = { title: "Registrieren" };

/**
 * Closed Beta: Das Formular erscheint nur mit Einladungslink (?einladung)
 * oder bei offener Registrierung. Ob eine Adresse wirklich eingeladen ist,
 * prueft der Server bei jeder Registrierung erneut.
 */
export default async function RegistrierenPage({ searchParams }: { searchParams: Promise<{ einladung?: string }> }) {
  const params = await searchParams;
  if (await getCurrentUser()) redirect("/app");

  const invited = params.einladung !== undefined || registrationOpen();

  if (!invited) {
    return (
      <>
        <h1 className="font-serif text-[34px] leading-tight">Noch geschlossen</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          Die Registrierung ist im Moment nur mit Einladung möglich. Trag dich auf die Warteliste ein – wir melden uns, sobald ein Platz frei
          ist.
        </p>
        <WaitlistForm compact className="mt-8" />
        <p className="mt-8 border-t border-line pt-5 text-[13px] text-ink-3">
          Schon ein Konto?{" "}
          <Link href="/anmelden" className="text-accent hover:underline">
            Anmelden
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="font-serif text-[34px] leading-tight">Konto anlegen</h1>
      <p className="mt-2 text-[15px] text-ink-2">Schön, dass du dabei bist.</p>
      <div className="mt-8">
        <SignUpForm discord={discordEnabled} />
      </div>
      <p className="mt-8 border-t border-line pt-5 text-[13px] text-ink-3">
        Schon ein Konto?{" "}
        <Link href="/anmelden" className="text-accent hover:underline">
          Anmelden
        </Link>
      </p>
    </>
  );
}
