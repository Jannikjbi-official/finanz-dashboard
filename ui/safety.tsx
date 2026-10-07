import type { SafetyLevel } from "@/lib/domain/safety";
import { SAFETY_LABEL } from "@/lib/domain/safety";
import { cx } from "./cx";

/**
 * Sicherheitszone als vierstufige Skala statt Ampel-Emoji: die aktive Stufe
 * ist gefuellt, die anderen bleiben als Kontext sichtbar.
 */
const ORDER: SafetyLevel[] = ["stable", "tight", "critical", "below"];

export const SAFETY_COLOR: Record<SafetyLevel, string> = {
  stable: "var(--pos)",
  tight: "var(--warn)",
  critical: "var(--caution)",
  below: "var(--neg)",
};

export function SafetyScale({ level, className }: { level: SafetyLevel; className?: string }) {
  const active = ORDER.indexOf(level);
  return (
    <div className={cx("flex items-center gap-3", className)}>
      <div className="flex gap-[3px]" aria-hidden>
        {ORDER.map((step, index) => (
          <span
            key={step}
            className="h-2.5 w-5 rounded-[1px]"
            style={{
              background: index === active ? SAFETY_COLOR[step] : "transparent",
              boxShadow: `inset 0 0 0 1px ${index === active ? SAFETY_COLOR[step] : "var(--line-strong)"}`,
            }}
          />
        ))}
      </div>
      <span className="text-[14px] font-semibold" style={{ color: SAFETY_COLOR[level] }}>
        {SAFETY_LABEL[level]}
      </span>
    </div>
  );
}

export function SafetyDot({ level }: { level: SafetyLevel }) {
  return <span aria-hidden className="inline-block size-2 rounded-[1px]" style={{ background: SAFETY_COLOR[level] }} />;
}
