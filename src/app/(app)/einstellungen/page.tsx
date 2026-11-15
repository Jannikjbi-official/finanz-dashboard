import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { SettingsView } from "@/components/settings/settings-view";
import { requireSession } from "@/lib/auth/session";
import { getSettings } from "@/server/queries";
import pkg from "../../../../package.json";

export const metadata: Metadata = { title: "Einstellungen" };

export default async function SettingsPage() {
  const session = await requireSession();
  const settings = await getSettings();
  const discordId = session.user.email.split("@")[0] ?? null;
  return (
    <>
      <PageHeader title="Einstellungen" description="Darstellung, Daten, Konto und App" />
      <SettingsView
        user={{
          name: session.user.name,
          image: session.user.image ?? null,
          discordId,
          emergency: session.user.name === "Notfall-Zugang" && !session.user.image,
        }}
        settings={settings}
        version={pkg.version}
      />
    </>
  );
}
