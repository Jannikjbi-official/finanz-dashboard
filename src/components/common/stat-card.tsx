import { Card, Chip } from "@heroui/react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { formatCents, formatChange, relativeChange } from "@/lib/money";

/**
 * Kennzahl-Card mit großer Zahl und Veränderung zum Vormonat.
 * `goodWhenUp`: bei Einnahmen ist ein Plus gut, bei Ausgaben schlecht.
 */
export function StatCard({
  label,
  cents,
  previousCents,
  icon,
  tone = "default",
  goodWhenUp = true,
  hint,
}: {
  label: string;
  cents: number;
  previousCents?: number;
  icon: ReactNode;
  tone?: "income" | "expense" | "accent" | "default";
  goodWhenUp?: boolean;
  hint?: ReactNode;
}) {
  const change = previousCents === undefined ? null : relativeChange(cents, previousCents);
  const up = change !== null && change > 0;
  const flat = change === 0;
  const good = flat ? null : goodWhenUp ? up : !up;
  const iconBg = {
    income: "bg-success/15 text-success",
    expense: "bg-danger/12 text-[var(--expense)]",
    accent: "bg-accent/15 text-accent",
    default: "bg-default text-foreground",
  }[tone];

  return (
    <Card className="animate-fade-up gap-3 rounded-3xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className={`flex size-10 items-center justify-center rounded-2xl ${iconBg}`} aria-hidden="true">
          {icon}
        </span>
        {change !== null ? (
          <Chip
            size="sm"
            variant="soft"
            color={good === null ? "default" : good ? "success" : "danger"}
            aria-label={`Veränderung zum Vormonat: ${formatChange(change)}`}
          >
            {flat ? <Minus className="size-3" /> : up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            <Chip.Label className="tabular">{formatChange(change)}</Chip.Label>
          </Chip>
        ) : previousCents !== undefined ? (
          <Chip size="sm" variant="soft">
            neu
          </Chip>
        ) : null}
      </div>
      <div>
        <p className="text-sm text-muted">{label}</p>
        <p
          className={`tabular mt-0.5 truncate text-2xl font-semibold tracking-tight sm:text-[1.75rem] ${
            tone === "expense" && cents > 0 ? "" : ""
          } ${cents < 0 ? "text-danger" : ""}`}
        >
          {formatCents(cents)}
        </p>
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>
    </Card>
  );
}
