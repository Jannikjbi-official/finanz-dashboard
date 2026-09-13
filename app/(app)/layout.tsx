import { requireUser } from "@/lib/session";
import { Shell } from "@/components/shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <Shell
      user={{ name: user.name, email: user.email, image: user.image ?? null }}
    >
      {children}
    </Shell>
  );
}
