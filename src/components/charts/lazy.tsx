"use client";

import { Skeleton } from "@heroui/react";
import dynamic from "next/dynamic";

/**
 * Diagramme werden nachgeladen: Recharts ist groß und für den ersten
 * Bildaufbau (Kennzahlen) nicht nötig → schnellerer Start, v. a. am Handy.
 */
const box = (h: number | string, round = "rounded-2xl") =>
  function ChartSkeleton() {
    return <Skeleton className={`w-full ${round}`} style={{ height: h }} />;
  };

export const CategoryDonut = dynamic(() => import("./charts").then((m) => m.CategoryDonut), {
  ssr: false,
  loading: () => (
    <div className="mx-auto aspect-square w-full max-w-[240px]">
      <Skeleton className="size-full rounded-full" />
    </div>
  ),
});
export const IncomeExpenseBars = dynamic(() => import("./charts").then((m) => m.IncomeExpenseBars), {
  ssr: false,
  loading: box(260),
});
export const BalanceArea = dynamic(() => import("./charts").then((m) => m.BalanceArea), {
  ssr: false,
  loading: box(220),
});
export const IncomeBars = dynamic(() => import("./charts").then((m) => m.IncomeBars), {
  ssr: false,
  loading: box(260),
});
export const SpendTimeline = dynamic(() => import("./charts").then((m) => m.SpendTimeline), {
  ssr: false,
  loading: box(320),
});
export { ChartLegend } from "./legend";
