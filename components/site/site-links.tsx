import Link from "next/link";
import type { ReactNode } from "react";

/** Links im Stil der Buttons - die oeffentlichen Seiten kommen ohne Client-JS aus. */
export function LinkButton({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" | "ghost" }) {
  const styles = {
    primary: "bg-accent text-accent-foreground hover:opacity-90",
    secondary: "bg-default text-foreground hover:bg-default-hover",
    ghost: "text-muted hover:text-foreground",
  }[variant];
  return (
    <Link
      href={href}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] px-4 text-[14px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-focus ${styles}`}
    >
      {children}
    </Link>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-7 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="7" className="fill-surface-secondary" />
        <path d="M9 21.5h14" className="stroke-accent" strokeWidth="2" strokeLinecap="round" />
        <path d="M11 17.5V12M16 17.5V9M21 17.5v-3.5" className="stroke-foreground" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <span className="leading-tight">
        <span className="block text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Jannikjbi</span>
        <span className="block text-[15px] font-semibold">Finanzen</span>
      </span>
    </span>
  );
}

/** Textseiten (Impressum, Datenschutz). */
export function Prose({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-[720px] px-4 py-12 sm:px-6 [&_a]:underline [&_a]:decoration-border [&_a]:underline-offset-4 [&_h2]:mt-8 [&_h2]:text-[16px] [&_h2]:font-semibold [&_p]:mt-2 [&_p]:text-muted [&_li]:text-muted [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children}
    </article>
  );
}

export function DraftNotice({ children }: { children: ReactNode }) {
  return <p className="mt-4 rounded-[var(--radius)] bg-warning-soft px-3 py-2 text-[13px] text-warning-soft-foreground">{children}</p>;
}
