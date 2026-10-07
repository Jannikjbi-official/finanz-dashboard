import { BRAND } from "@/lib/brand";
import { cx } from "./cx";

/**
 * Bildmarke: die Zeitachse - gebuchte Vergangenheit als Linie, heute als
 * Punkt, die Prognose gestrichelt.
 */
export function Mark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={cx("shrink-0", className)}>
      <rect width="24" height="24" rx="4" fill="var(--ink)" />
      <path d="M4.5 16.5 L10.5 13" stroke="var(--paper)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12.4" cy="11.9" r="2" fill="var(--accent)" stroke="var(--ink)" strokeWidth="0.6" />
      <path d="M14.6 10.6 L19.5 7.6" stroke="var(--paper)" strokeWidth="2" strokeLinecap="round" strokeDasharray="1.6 2.4" />
    </svg>
  );
}

export function Wordmark({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <Mark size={size} />
      <span className="text-[16px] font-semibold tracking-[-0.015em]">{BRAND.name}</span>
    </span>
  );
}
