import { moneyParts } from "@/lib/format";
import { cx } from "./cx";

type Tone = "plain" | "flow" | "muted";

/**
 * Betrag mit Tabellenziffern; Cent etwas kleiner, damit der Euro-Betrag
 * zuerst gelesen wird.
 *
 * tone="flow": Eingaenge gruen mit +, Ausgaenge in Tinte mit Minus - Geld,
 * das rausgeht, ist normal und wird nicht rot eingefaerbt.
 */
export function Money({
  cents,
  signed = false,
  tone = "plain",
  whole = false,
  className,
  centsClassName,
}: {
  cents: number;
  signed?: boolean;
  tone?: Tone;
  whole?: boolean;
  className?: string;
  centsClassName?: string;
}) {
  const parts = moneyParts(cents, { signed: signed || tone === "flow" });
  const color =
    tone === "flow" ? (cents > 0 ? "text-pos" : "text-ink") : tone === "muted" ? "text-ink-3" : undefined;

  return (
    <span className={cx("num whitespace-nowrap", color, className)}>
      {parts.sign}
      {parts.whole}
      {!whole && <span className={cx("text-[0.82em] opacity-80", centsClassName)}>,{parts.fraction}</span>}
      <span className="ml-[0.2em] text-[0.82em] opacity-80">{parts.currency}</span>
    </span>
  );
}

/** Vorzeichen-Delta mit Pfeilrichtung in Textform, z. B. "+12 %". */
export function Delta({
  value,
  text,
  invert = false,
  className,
}: {
  value: number;
  text: string;
  /** Bei Ausgaben ist "mehr" schlechter. */
  invert?: boolean;
  className?: string;
}) {
  const good = invert ? value < 0 : value > 0;
  const color = value === 0 ? "text-ink-3" : good ? "text-pos" : "text-caution";
  return <span className={cx("num text-[0.92em]", color, className)}>{text}</span>;
}
