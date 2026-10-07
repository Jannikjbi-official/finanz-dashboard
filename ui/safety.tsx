import type { SafetyLevel } from "@/lib/domain/safety";
import { SAFETY_LABEL } from "@/lib/domain/safety";
import { cx } from "./cx";

export const SAFETY_COLOR: Record<SafetyLevel, string> = {
  stable: "var(--pos)",
  tight: "var(--warn)",
  critical: "var(--caution)",
  below: "var(--neg)",
};

const ORDER: SafetyLevel[] = ["stable", "tight", "critical", "below"];

/**
 * Sicherheitszone als Status-Chip mit leuchtendem Punkt und vierstufiger
 * Skala - die aktive Stufe ist gefuellt, die anderen bleiben als Kontext.
 */
export function SafetyScale({ level, className, compact = false }: { level: SafetyLevel; className?: string; compact?: boolean }) {
  const active = ORDER.indexOf(level);
  const color = SAFETY_COLOR[level];
  return (
    <span
      className={cx("inline-flex items-center gap-2.5 rounded-full py-1.5 pl-2.5 pr-3.5", className)}
      style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <span className="relative flex size-2.5" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full opacity-50" style={{ background: color, animationDuration: "2.4s" }} />
        <span className="relative inline-flex size-2.5 rounded-full" style={{ background: color }} />
      </span>
      <span className="text-[13px] font-bold" style={{ color }}>
        {SAFETY_LABEL[level]}
      </span>
      {!compact ? (
        <span className="flex gap-[3px]" aria-hidden>
          {ORDER.map((step, index) => (
            <span
              key={step}
              className="h-1.5 w-3.5 rounded-full"
              style={{ background: index <= active ? color : `color-mix(in srgb, ${color} 25%, transparent)` }}
            />
          ))}
        </span>
      ) : null}
    </span>
  );
}

export function SafetyDot({ level }: { level: SafetyLevel }) {
  return <span aria-hidden className="inline-block size-2.5 rounded-full" style={{ background: SAFETY_COLOR[level] }} />;
}
