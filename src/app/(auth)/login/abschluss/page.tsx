import type { Metadata } from "next";
import { HandoffComplete } from "@/components/auth/handoff-complete";
import { safeRedirect } from "@/lib/utils";

export const metadata: Metadata = { title: "Anmeldung abschließen" };

export default async function HandoffPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; weiter?: string }>;
}) {
  const { code, weiter } = await searchParams;
  return <HandoffComplete code={code ?? null} target={safeRedirect(weiter)} />;
}
