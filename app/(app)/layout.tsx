import { requireUser } from "@/lib/session";
import { Shell } from "@/components/shell";
import { Providers } from "../providers";

/** Alte Oberflaeche - laeuft parallel, bis die neue sie vollstaendig ersetzt. */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="dark legacy">
      <Providers>
        <Shell
          user={{ name: user.name, email: user.email, image: user.image ?? null }}
        >
          {children}
        </Shell>
      </Providers>
    </div>
  );
}
