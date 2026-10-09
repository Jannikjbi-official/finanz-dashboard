import { cx } from "./cx";

/** Seitenkopf: grosser, kraeftiger Titel, Aktionen rechts. */
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
        {eyebrow ? <p className="mb-1.5 text-[13px] font-medium text-ink-3">{eyebrow}</p> : null}
        <h1 className="text-[30px] font-bold leading-tight tracking-[-0.035em] sm:text-[36px]">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Abschnitt als Karte. */
export function Section({
  title,
  aside,
  description,
  children,
  className,
  id,
  flush = false,
}: {
  title?: React.ReactNode;
  aside?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
  /** Ohne Kartenflaeche (fuer Inhalte, die selbst Karten sind). */
  flush?: boolean;
}) {
  return (
    <section id={id} className={cx(!flush && "card", "min-w-0 scroll-mt-28", className)}>
      {title || aside ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <div>
            {title ? <h2 className="text-[17px] font-bold tracking-[-0.02em]">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-[13px] text-ink-3">{description}</p> : null}
          </div>
          {aside ? <div className="flex items-center gap-3 text-[13px] font-medium">{aside}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Kennzahlen als Kacheln. */
export function Figures({
  items,
  className,
}: {
  items: Array<{ label: React.ReactNode; value: React.ReactNode; note?: React.ReactNode; tone?: "accent" | "default" }>;
  className?: string;
}) {
  const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4", 5: "sm:grid-cols-3 lg:grid-cols-5" }[
    Math.min(5, Math.max(2, items.length)) as 2 | 3 | 4 | 5
  ];
  return (
    <dl className={cx("grid grid-cols-2 gap-3", cols, className)}>
      {items.map((item, index) => (
        <div
          key={index}
          className={cx(
            "flex min-w-0 flex-col gap-1 rounded-[18px] border p-4",
            item.tone === "accent" ? "border-transparent bg-accent text-accent-ink" : "border-line bg-surface",
          )}
        >
          <dt className={cx("text-[12px] font-medium", item.tone === "accent" ? "opacity-70" : "text-ink-3")}>{item.label}</dt>
          <dd className="truncate text-[21px] font-bold tracking-[-0.03em]">{item.value}</dd>
          {item.note ? <dd className={cx("text-[12px]", item.tone === "accent" ? "opacity-70" : "text-ink-3")}>{item.note}</dd> : null}
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
    <div className={cx("flex flex-col items-start gap-2 rounded-[18px] border border-dashed border-line-strong bg-surface/50 p-6", className)}>
      <p className="text-[16px] font-bold tracking-[-0.01em]">{title}</p>
      {children ? <div className="max-w-lg text-[14px] leading-relaxed text-ink-2">{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Erklaerender Hinweis, z. B. "So rechnen wir". */
export function Note({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cx("rounded-[14px] bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-ink-3", className)}>{children}</p>;
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
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

/** Farbpunkt einer Kategorie oder eines Kontos. */
export function Swatch({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={cx("inline-block size-2.5 shrink-0 rounded-full", className)} style={{ background: color }} />;
}

/** Runde Icon-Kachel mit getoenter Flaeche. */
export function IconTile({ color, children, className }: { color: string; children: React.ReactNode; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx("inline-flex size-10 shrink-0 items-center justify-center rounded-[12px]", className)}
      style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
    >
      {children}
    </span>
  );
}
