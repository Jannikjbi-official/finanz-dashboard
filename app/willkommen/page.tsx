import { requireUser } from "@/lib/session";
import { categories } from "@/lib/mongo";
import { getSettings } from "@/lib/server/user-data";
import { todayIn } from "@/lib/domain/calendar";
import { ToastProvider } from "@/ui/toast";
import { Onboarding } from "@/features/onboarding/onboarding";

export const metadata = { title: "Willkommen", robots: { index: false } };

/** Eigener Rahmen ohne Navigation - die Einrichtung soll nicht ablenken. */
export default async function WillkommenPage() {
  const user = await requireUser();
  const [settings, categoryDocs] = await Promise.all([
    getSettings(user.id),
    categories.find({ userId: user.id }).toArray(),
  ]);

  return (
    <ToastProvider>
      <Onboarding
        name={user.name}
        today={todayIn(settings.timeZone)}
        categories={categoryDocs.map((doc) => ({ id: doc._id.toString(), name: doc.name, kind: doc.kind }))}
      />
    </ToastProvider>
  );
}
