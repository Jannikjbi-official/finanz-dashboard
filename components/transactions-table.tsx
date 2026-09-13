"use client";

import {
  Chip,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { deleteTransaction } from "@/lib/actions";
import { formatDate, formatMoney } from "@/lib/money";
import { ActionButton } from "@/components/action-button";
import { TransactionDialog } from "@/components/transaction-dialog";
import type { Category, Transaction } from "@/lib/types";

/**
 * Muss eine Client-Komponente sein: HeroUI baut die Tabelle ueber eine
 * react-stately Collection, und dafuer muss der Komponententyp der Zeilen
 * und Spalten zur Laufzeit sichtbar sein. Aus einer Server Component kaeme
 * dort nur eine RSC-Client-Referenz an.
 */
export function TransactionsTable({
  rows,
  categories,
}: {
  rows: Transaction[];
  categories: Category[];
}) {
  const byId = new Map(categories.map((category) => [category.id, category]));

  return (
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
        <TableColumn align="end">Aktionen</TableColumn>
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
                    <span className="text-tiny text-default-400">{tx.note}</span>
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
                      <span className="inline-flex h-8 cursor-pointer items-center rounded-lg px-3 text-tiny text-default-500 hover:bg-default-100 hover:text-foreground">
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
  );
}
