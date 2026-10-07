import { cx } from "./cx";

/**
 * Seitenkopf: Titel links, Aktionen rechts. Bewusst zurueckhaltend - die
 * Zahlen darunter sind wichtiger als die Ueberschrift.
 */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1.5 text-[13px] text-ink-3">{eyebrow}</p> : null}
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] sm:text-[28px]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Abschnitt mit Haarlinie statt Box. */
export function Section({
  title,
  aside,
  description,
  children,
  className,
  id,
}: {
  title?: React.ReactNode;
  aside?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cx("border-t border-ink/80 pt-3", className)}>
      {title || aside ? (
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div>
            {title ? <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-[13px] text-ink-3">{description}</p> : null}
          </div>
          {aside ? <div className="flex items-center gap-3 text-[13px]">{aside}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * Kennzahlen als liniertes Raster - keine Karten. Auf dem Handy zwei
 * Spalten, ab sm so viele wie Eintraege.
 */
export function Figures({
  items,
  className,
}: {
  items: Array<{ label: React.ReactNode; value: React.ReactNode; note?: React.ReactNode }>;
  className?: string;
}) {
  const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4", 5: "sm:grid-cols-5" }[
    Math.min(5, Math.max(2, items.length)) as 2 | 3 | 4 | 5
  ];
  return (
    <dl className={cx("grid grid-cols-2 border-b border-line", cols, className)}>
      {items.map((item, index) => (
        <div
          key={index}
          className={cx(
            "flex flex-col gap-1 border-t border-line py-3 pr-4",
            index % 2 === 1 && "pl-4 max-sm:border-l",
            index > 0 && "sm:border-l sm:pl-4",
          )}
        >
          <dt className="text-[12px] text-ink-3">{item.label}</dt>
          <dd className="text-[19px] font-medium tracking-[-0.01em]">{item.value}</dd>
          {item.note ? <dd className="text-[12px] text-ink-3">{item.note}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

export function Empty({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col items-start gap-2 border-y border-dashed border-line-strong py-8", className)}>
      <p className="text-[15px] font-medium">{title}</p>
      {children ? <div className="max-w-lg text-[14px] leading-relaxed text-ink-2">{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Erklaerender Hinweis in ruhiger Form, z. B. "So rechnen wir". */
export function Note({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cx("border-l-2 border-line-strong pl-3 text-[13px] leading-relaxed text-ink-3", className)}>{children}</p>
  );
}

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "pos" | "warn" | "caution" | "neg" | "accent";
  className?: string;
}) {
  const tones = {
    neutral: "bg-sunken text-ink-2",
    pos: "bg-pos-soft text-pos",
    warn: "bg-warn-soft text-warn",
    caution: "bg-caution-soft text-caution",
    neg: "bg-neg-soft text-neg",
    accent: "bg-accent-soft text-accent",
  };
  return (
    <span className={cx("inline-flex items-center rounded-xs px-1.5 py-px text-[11.5px] font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

/** Farbpunkt einer Kategorie oder eines Kontos. */
export function Swatch({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={cx("inline-block size-2 shrink-0 rounded-[1px]", className)} style={{ background: color }} />;
}
