import type { ReactNode } from "react";

/** Flaeche mit Linie und optionalem Kopf. Bewusst schlicht, kein Schatten. */
export function Panel({
  title,
  description,
  action,
  children,
  className = "",
  bodyClassName = "p-4 sm:p-5",
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section className={`panel min-w-0 ${className}`} aria-labelledby={id && title ? `${id}-title` : undefined}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-separator px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && (
              <h2 id={id ? `${id}-title` : undefined} className="text-[15px] font-semibold leading-[22px]">
                {title}
              </h2>
            )}
            {description && <p className="label mt-0.5">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** Seitenkopf: Titel links, Aktionen rechts. */
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold leading-7">{title}</h1>
        {description && <p className="mt-0.5 text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Beschriftete Kennzahl in einer Zeile/Spalte. */
export function Stat({ label, value, hint, className = "" }: { label: ReactNode; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="label">{label}</div>
      <div className="num mt-1 text-[22px] font-semibold leading-7 tracking-[-0.01em]">{value}</div>
      {hint && <div className="label mt-0.5 font-normal">{hint}</div>}
    </div>
  );
}

/** Kennzahl in einer Kennzahlenleiste (zwei Spalten mobil, vier ab md). */
export function SummaryCell({ label, value, hint }: { label: string; value: ReactNode; hint: ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-4 sm:px-5 [&:nth-child(n+3)]:border-t [&:nth-child(n+3)]:border-separator md:[&:nth-child(n+3)]:border-t-0">
      <div className="label">{label}</div>
      <div className="num mt-1 text-[22px] font-semibold leading-7">{value}</div>
      <div className="label mt-0.5 truncate font-normal">{hint}</div>
    </div>
  );
}
