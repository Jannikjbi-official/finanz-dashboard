import { Fragment } from "react";
import { formatMoney } from "@/lib/format";

/**
 * Zahl mit Tabellenziffern, aber proportionalen Trennzeichen: Ziffern stehen
 * in Spalten exakt untereinander, Punkt und Komma bleiben schmal.
 */
export function Figures({ text }: { text: string }) {
  const parts = text.split(/([.,])/);
  return (
    <>
      {parts.map((part, index) =>
        part === "." || part === "," ? (
          <span key={index} className="sep">
            {part}
          </span>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * Betrag. `tone="auto"` faerbt nur negative Werte rot - positive bleiben in
 * Textfarbe, damit keine gruenen Zahlenwaende entstehen.
 */
export function Money({
  cents,
  signed = false,
  whole = false,
  tone = "auto",
  className = "",
}: {
  cents: number;
  signed?: boolean;
  whole?: boolean;
  tone?: "auto" | "plain" | "muted";
  className?: string;
}) {
  const color = tone === "muted" ? "text-muted" : tone === "auto" && cents < 0 ? "text-danger" : "";
  return (
    <span className={`num whitespace-nowrap ${color} ${className}`}>
      <Figures text={formatMoney(cents, { signed, whole })} />
    </span>
  );
}
