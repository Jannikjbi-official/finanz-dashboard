import { Card, CardBody, CardHeader, Chip, Snippet } from "@heroui/react";
import { requireUser } from "@/lib/session";
import { getCategories } from "@/lib/queries";
import { CategoryManager } from "@/components/category-manager";

export default async function SettingsPage() {
  const user = await requireUser();
  const categories = await getCategories(user.id);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Einstellungen</h1>
        <p className="text-sm text-default-500">
          Kategorien für Einnahmen und Ausgaben verwalten.
        </p>
      </header>

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

      <Card className="border border-default-100 bg-content1/60 backdrop-blur">
        <CardHeader className="pb-0">
          <h2 className="text-sm font-semibold">Konto</h2>
        </CardHeader>
        <CardBody className="gap-3 p-5 text-sm">
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
            Neue Konten sind gesperrt. Nur Adressen aus ALLOWED_EMAILS in der
            .env-Datei können sich registrieren – per E-Mail oder Discord.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
