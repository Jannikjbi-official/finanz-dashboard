import { requireUser } from "@/lib/session";
import { accounts } from "@/lib/mongo";
import { PageHeader } from "@/ui/layout";
import { ImportWizard } from "@/features/geld/import-wizard";

export const metadata = { title: "Import" };

export default async function ImportPage() {
  const user = await requireUser();
  const docs = await accounts.find({ userId: user.id }).sort({ createdAt: 1 }).toArray();

  return (
    <>
      <PageHeader title="Import" description="Buchungen aus dem Online-Banking oder einer anderen App übernehmen." />
      <ImportWizard
        accounts={docs.map((doc) => ({ id: doc._id.toString(), name: doc.name, color: doc.color, archived: doc.archived }))}
      />
    </>
  );
}
