import {
  Card,
  CardBody,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { requireUser } from "@/lib/session";
import { getCategories, getTransactions } from "@/lib/queries";
import { currentMonthKey } from "@/lib/dates";
import { formatDate, formatMoney, formatSigned } from "@/lib/money";
import { MonthSwitcher } from "@/components/month-switcher";
import { TransactionDialog } from "@/components/transaction-dialog";
import { TransactionFilters } from "@/components/transaction-filters";
import { ActionButton } from "@/components/action-button";
import { deleteTransaction } from "@/lib/actions";

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

  const byId = new Map(categories.map((category) => [category.id, category]));

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
        <TransactionFilters categories={categories} />

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
          <Table
            aria-label="Buchungen"
            removeWrapper
            classNames={{ th: "bg-transparent text-tiny uppercase" }}
          >
            <TableHeader>
              <TableColumn>Datum</TableColumn>
              <TableColumn>Bezeichnung</TableColumn>
              <TableColumn>Kategorie</TableColumn>
              <TableColumn align="end">Betrag</TableColumn>
              <TableColumn align="end">{" "}</TableColumn>
            </TableHeader>
            <TableBody emptyContent="Keine Buchungen in diesem Monat.">
              {rows.map((tx) => {
                const category = tx.categoryId ? byId.get(tx.categoryId) : undefined;

                return (
                  <TableRow key={tx.id}>
                    <TableCell className="whitespace-nowrap text-default-500">
                      {formatDate(tx.date)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{tx.title}</span>
                        {tx.note ? (
                          <span className="text-tiny text-default-400">
                            {tx.note}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {category ? (
                        <Chip
                          size="sm"
                          variant="flat"
                          style={{
                            backgroundColor: `${category.color}22`,
                            color: category.color,
                          }}
                        >
                          {category.icon ? `${category.icon} ` : ""}
                          {category.name}
                        </Chip>
                      ) : (
                        <span className="text-tiny text-default-400">&ndash;</span>
                      )}
                    </TableCell>
                    <TableCell
                      className={`whitespace-nowrap text-right tabular-nums ${
                        tx.type === "income" ? "text-success" : "text-danger"
                      }`}
                    >
                      {tx.type === "income" ? "+" : "-"}
                      {formatMoney(tx.amountCents)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <TransactionDialog
                          categories={categories}
                          transaction={tx}
                          trigger={
                            <span className="cursor-pointer rounded-lg px-2 py-1 text-tiny text-default-500 hover:bg-default-100 hover:text-foreground">
                              Bearbeiten
                            </span>
                          }
                        />
                        <ActionButton
                          action={deleteTransaction}
                          id={tx.id}
                          color="danger"
                          confirm="Buchung wirklich löschen?"
                          title="Löschen"
                        >
                          Löschen
                        </ActionButton>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
