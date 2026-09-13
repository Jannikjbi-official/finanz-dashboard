import { Card, CardBody, Chip } from "@heroui/react";
import { requireUser } from "@/lib/session";
import { getCategories, getTransactions } from "@/lib/queries";
import { currentMonthKey } from "@/lib/dates";
import { formatMoney, formatSigned } from "@/lib/money";
import { MonthSwitcher } from "@/components/month-switcher";
import { TransactionDialog } from "@/components/transaction-dialog";
import { TransactionFilters } from "@/components/transaction-filters";
import { TransactionsTable } from "@/components/transactions-table";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; type?: string; cat?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(params.m ?? "")
    ? params.m!
    : currentMonthKey();

  const [categories, all] = await Promise.all([
    getCategories(user.id),
    getTransactions(user.id, { month }),
  ]);

  const rows = all.filter((tx) => {
    if (params.type === "income" && tx.type !== "income") return false;
    if (params.type === "expense" && tx.type !== "expense") return false;
    if (params.cat === "none" && tx.categoryId) return false;
    if (params.cat && params.cat !== "all" && params.cat !== "none") {
      if (tx.categoryId !== params.cat) return false;
    }
    return true;
  });

  const income = rows
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + tx.amountCents, 0);
  const expense = rows
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + tx.amountCents, 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Buchungen</h1>
          <p className="text-sm text-default-500">
            Alle Einnahmen und Ausgaben des Monats.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <MonthSwitcher month={month} basePath="/transaktionen" />
          <TransactionDialog categories={categories} />
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <TransactionFilters
          categories={categories}
          month={month}
          type={params.type ?? "all"}
          category={params.cat ?? "all"}
        />

        <div className="flex gap-2">
          <Chip variant="flat" color="success">
            + {formatMoney(income)}
          </Chip>
          <Chip variant="flat" color="danger">
            - {formatMoney(expense)}
          </Chip>
          <Chip variant="flat">Saldo {formatSigned(income - expense)}</Chip>
        </div>
      </div>

      <Card className="border border-default-100 bg-content1/60 backdrop-blur">
        <CardBody className="p-0">
          <TransactionsTable rows={rows} categories={categories} />
        </CardBody>
      </Card>
    </div>
  );
}
