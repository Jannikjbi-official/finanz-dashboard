"use client";

import { Receipt } from "lucide-react";
import { createContext, type ReactNode, use, useCallback, useMemo, useState } from "react";
import { ResponsiveSheet } from "@/components/common/responsive-sheet";
import { ExpenseForm, type ExpenseFormValues } from "@/components/expenses/expense-form";
import type { CategoryOption } from "@/components/forms/fields";

interface QuickAddContextValue {
  openExpense: (initial?: Partial<ExpenseFormValues>) => void;
  categories: CategoryOption[];
}

const QuickAddContext = createContext<QuickAddContextValue | null>(null);

export function useQuickAdd() {
  const ctx = use(QuickAddContext);
  if (!ctx) throw new Error("useQuickAdd außerhalb von QuickAddProvider");
  return ctx;
}

/**
 * Globales „Ausgabe hinzufügen“: am Handy ein Drawer von unten (wischen zum
 * Schließen), am PC ein Modal. Betrag ist sofort fokussiert.
 */
export function QuickAddProvider({ categories, children }: { categories: CategoryOption[]; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<Partial<ExpenseFormValues> | undefined>();
  const [formKey, setFormKey] = useState(0);

  const openExpense = useCallback((init?: Partial<ExpenseFormValues>) => {
    setInitial(init);
    setFormKey((k) => k + 1);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ openExpense, categories }), [openExpense, categories]);
  const title = initial?.id ? "Ausgabe bearbeiten" : "Neue Ausgabe";
  const form = (
    <ExpenseForm key={formKey} categories={categories} initial={initial} onDone={() => setOpen(false)} />
  );

  return (
    <QuickAddContext value={value}>
      {children}
      <ResponsiveSheet isOpen={open} onOpenChange={setOpen} title={title} icon={<Receipt className="size-5" />}>
        {form}
      </ResponsiveSheet>
    </QuickAddContext>
  );
}
