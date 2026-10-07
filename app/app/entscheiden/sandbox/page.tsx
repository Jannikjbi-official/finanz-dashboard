import { requireUser } from "@/lib/session";
import { scenarios } from "@/lib/mongo";
import { loadFinancialPicture } from "@/lib/server/finance";
import { isISODate } from "@/lib/domain/calendar";
import { Sandbox } from "@/features/entscheiden/sandbox";

export const metadata = { title: "Sandbox" };

export default async function SandboxPage({
  searchParams,
}: {
  searchParams: Promise<{ betrag?: string; was?: string; datum?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const [picture, saved] = await Promise.all([
    loadFinancialPicture(user.id, { horizonDays: 1 }),
    scenarios.find({ userId: user.id }).sort({ updatedAt: -1 }).limit(20).toArray(),
  ]);

  // Uebernahme aus dem Kaufcheck: Betrag in Cent
  const cents = Number(params.betrag);
  const initial =
    Number.isInteger(cents) && cents > 0
      ? [
          {
            id: "kauf",
            label: (params.was ?? "Kauf").slice(0, 60),
            amountCents: -cents,
            repeat: "once" as const,
            date: params.datum && isISODate(params.datum) && params.datum >= picture.today ? params.datum : picture.today,
            until: null,
          },
        ]
      : [];

  return (
    <Sandbox
      input={picture.forecastInput}
      reserve={picture.reserve}
      initial={initial}
      scenarios={saved.map((doc) => ({ id: doc._id.toString(), name: doc.name, events: doc.events }))}
    />
  );
}
