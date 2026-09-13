import { Card, CardBody, CardHeader } from "@heroui/react";
import { formatMoney } from "@/lib/money";

export type Tone =
  | "default"
  | "success"
  | "danger"
  | "warning"
  | "primary"
  | "muted";

const TONE_TEXT: Record<Tone, string> = {
  default: "text-foreground",
  success: "text-success",
  danger: "text-danger",
  warning: "text-warning",
  primary: "text-primary",
  muted: "text-default-500",
};

export const surface =
  "border border-default-100/80 bg-content1/50 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset] backdrop-blur";

/** Seitenkopf mit Titel, Beschreibung und optionalen Aktionen. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-default-500">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

/** Kennzahl-Karte: grosse Zahl, kleiner Zusatz. */
export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  accent,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  tone?: Tone;
  accent?: string;
}) {
  return (
    <Card className={surface} shadow="none">
      <CardBody className="gap-1.5 p-5">
        <span className="text-tiny font-medium uppercase tracking-wider text-default-400">
          {label}
        </span>
        <span
          className={`text-[1.75rem] font-semibold leading-none tabular-nums ${TONE_TEXT[tone]}`}
          style={accent ? { color: accent } : undefined}
        >
          {value}
        </span>
        {hint ? (
          <span className="text-tiny text-default-400">{hint}</span>
        ) : null}
      </CardBody>
    </Card>
  );
}

/** Karte mit Kopfzeile und Inhalt. */
export function SectionCard({
  title,
  description,
  action,
  children,
  className = "",
  bodyClassName = "p-5",
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={`${surface} ${className}`} shadow="none">
      {title ? (
        <CardHeader className="flex items-start justify-between gap-3 px-5 pb-0 pt-5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-tiny text-default-400">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </CardHeader>
      ) : null}
      <CardBody className={bodyClassName}>{children}</CardBody>
    </Card>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <p className="text-sm text-default-500">{title}</p>
      {hint ? <p className="text-tiny text-default-400">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Betrag mit Vorzeichen und Farbe je nach Richtung. */
export function Amount({
  cents,
  kind,
  className = "",
  signed = true,
}: {
  cents: number;
  kind: "income" | "expense";
  className?: string;
  signed?: boolean;
}) {
  return (
    <span
      className={`tabular-nums ${
        kind === "income" ? "text-success" : "text-danger"
      } ${className}`}
    >
      {signed ? (kind === "income" ? "+" : "−") : ""}
      {formatMoney(cents)}
    </span>
  );
}

/** Schmaler Fortschrittsbalken, z.B. fuer Budgets. */
export function Bar({
  value,
  max,
  color = "#6366f1",
  overColor = "#f43f5e",
}: {
  value: number;
  max: number;
  color?: string;
  overColor?: string;
}) {
  const share = max > 0 ? (value / max) * 100 : 0;
  const over = share > 100;

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-default-100">
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${Math.min(100, Math.max(share > 0 ? 2 : 0, share))}%`,
          background: over ? overColor : color,
        }}
      />
    </div>
  );
}
