import type { DueState } from "@/lib/domain/recurring";

export type StatusTone = "danger" | "warning" | "success" | "neutral" | "accent";

const DOT: Record<StatusTone, string> = {
  danger: "bg-danger",
  warning: "bg-warning",
  success: "bg-success",
  neutral: "bg-muted/60",
  accent: "bg-accent",
};

/** Kleiner Farbpunkt mit Text - Status ohne laute Flaechen. */
export function Status({ tone, children, className = "" }: { tone: StatusTone; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] leading-[18px] ${className}`}>
      <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${DOT[tone]}`} />
      <span className={tone === "danger" ? "text-danger" : "text-muted"}>{children}</span>
    </span>
  );
}

export function dueTone(state: DueState): StatusTone {
  return state === "overdue" ? "danger" : state === "today" || state === "soon" ? "warning" : "neutral";
}
