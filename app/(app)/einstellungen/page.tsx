import { Chip, Snippet } from "@heroui/react";
import { requireUser } from "@/lib/session";
import { getCategories } from "@/lib/queries";
import { CategoryManager } from "@/components/category-manager";
import { PageHeader, SectionCard } from "@/components/ui";

export default async function SettingsPage() {
  const user = await requireUser();
  const categories = await getCategories(user.id);

  const expense = categories.filter((entry) => entry.kind === "expense").length;
  const income = categories.filter((entry) => entry.kind === "income").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Einstellungen"
        description={`${expense} Ausgaben- und ${income} Einnahmen-Kategorien.`}
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <CategoryManager
          kind="expense"
          title="Ausgaben-Kategorien"
          categories={categories}
        />
        <CategoryManager
          kind="income"
          title="Einnahmen-Kategorien"
          categories={categories}
        />
      </section>

      <SectionCard title="Konto">
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-default-500">Angemeldet als</span>
            <Snippet size="sm" hideSymbol variant="flat">
              {user.email}
            </Snippet>
            {user.emailVerified ? (
              <Chip size="sm" color="success" variant="flat">
                verifiziert
              </Chip>
            ) : null}
          </div>
          <p className="text-tiny text-default-400">
            Neue Konten sind gesperrt. Nur Adressen aus ALLOWED_EMAILS können
            sich registrieren – per E-Mail oder Discord.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
