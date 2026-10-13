import { Status } from "@/components/ui/status";
import { daysBetween } from "@/lib/domain/calendar";
import { formatRelativeDays } from "@/lib/format";

/** Zahlungsstatus eines offenen Postens relativ zu heute. */
export function ItemStatus({ date, type, today, bankPending }: { date: string; type: "income" | "expense"; today: string; bankPending?: boolean }) {
  if (bankPending) return <Status tone="accent">Vorgemerkt</Status>;
  const days = daysBetween(today, date);
  if (days < 0) return <Status tone="danger">{type === "income" ? "Ausstehend" : "Überfällig"} seit {-days} {-days === 1 ? "Tag" : "Tagen"}</Status>;
  if (days === 0) return <Status tone="warning">Heute fällig</Status>;
  if (type === "income") return <Status tone="accent">Erwartet {formatRelativeDays(days)}</Status>;
  if (days <= 7) return <Status tone="warning">Fällig {formatRelativeDays(days)}</Status>;
  return <Status tone="neutral">Geplant</Status>;
}
