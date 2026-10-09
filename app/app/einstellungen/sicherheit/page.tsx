import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/session";
import { PageHeader, Section } from "@/ui/layout";
import { ChangePassword, Sessions } from "@/features/settings/account-security";

export const metadata = { title: "Anmeldung & Sicherheit" };

export default async function SicherheitPage() {
  await requireUser();
  const session = await auth.api.getSession({ headers: await headers() });
  const accounts = await auth.api.listUserAccounts({ headers: await headers() });
  const hasPassword = accounts.some((account) => account.providerId === "credential");

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageHeader title="Anmeldung & Sicherheit" />

      <Section title="Passwort">
        {hasPassword ? <ChangePassword /> : <p className="text-[14px] text-ink-2">Du meldest dich über Discord an und hast kein eigenes Passwort.</p>}
      </Section>

      <Section title="Angemeldete Geräte" description="Melde Geräte ab, die du nicht mehr nutzt oder nicht kennst.">
        <Sessions currentToken={session?.session.token ?? null} />
      </Section>
    </div>
  );
}
