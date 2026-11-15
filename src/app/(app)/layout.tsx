import type { ReactNode } from "react";
import { ViewTransition } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { requireSession } from "@/lib/auth/session";
import { getCategories, getSettings } from "@/server/queries";
import pkg from "../../../package.json";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const [categories, settings] = await Promise.all([getCategories(), getSettings()]);
  return (
    <>
      {settings.accentColor && (
        <style>{`:root,.light,.dark,[data-theme]{--accent:${settings.accentColor};}`}</style>
      )}
      <AppShell
        user={{ name: session.user.name, image: session.user.image ?? null }}
        categories={categories.map(({ id, name, color, icon }) => ({ id, name, color, icon }))}
        version={pkg.version}
      >
        <ViewTransition enter="page-enter" exit="page-exit" default="none">
          {children}
        </ViewTransition>
      </AppShell>
    </>
  );
}
