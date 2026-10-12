import { Providers } from "@/components/providers";
import { AppShell } from "@/components/shell/app-shell";
import { getFinanceData } from "@/lib/server/data";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const data = await getFinanceData(user.id);
  return (
    <Providers>
      <AppShell lookups={{ accounts: data.accounts, categories: data.categories, today: data.today }} userName={user.name || user.email}>
        {children}
      </AppShell>
    </Providers>
  );
}
