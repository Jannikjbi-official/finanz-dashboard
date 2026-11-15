import { EmptyState } from "@heroui/react";
import type { ReactNode } from "react";

/** Schöner leerer Zustand mit Icon, Text und Aktion. */
export function Empty({
  icon,
  title,
  text,
  action,
  className = "",
}: {
  icon: ReactNode;
  title: string;
  text?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <EmptyState className={`flex flex-col items-center justify-center gap-3 px-6 py-12 text-center ${className}`}>
      <div className="flex size-14 items-center justify-center rounded-3xl bg-accent/12 text-accent" aria-hidden="true">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        {text && <p className="mx-auto max-w-xs text-sm text-muted">{text}</p>}
      </div>
      {action}
    </EmptyState>
  );
}
