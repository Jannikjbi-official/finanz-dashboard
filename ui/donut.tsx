import { formatMoney } from "@/lib/format";

export type DonutSlice = { label: string; cents: number; color: string };

/**
 * Ring-Diagramm fuer Anteile (z. B. Ausgaben nach Kategorie). Abgerundete
 * Segmente mit kleinen Luecken, Summe in der Mitte.
 */
export function Donut({
  slices,
  size = 180,
  thickness = 18,
  centerLabel,
  centerValue,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: number;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.cents, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = slices.length > 1 ? 6 : 0;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${centerLabel ?? "Anteile"}: ${slices.map((s) => `${s.label} ${formatMoney(s.cents, { whole: true })}`).join(", ")}`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--sunken)" strokeWidth={thickness} />
      {total > 0
        ? slices.map((slice) => {
            const length = (slice.cents / total) * circumference;
            const visible = Math.max(0, length - gap);
            const dash = `${visible} ${circumference - visible}`;
            const element = (
              <circle
                key={slice.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={thickness}
                strokeLinecap={visible > thickness ? "round" : "butt"}
                strokeDasharray={dash}
                strokeDashoffset={-offset - gap / 2}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
            offset += length;
            return element;
          })
        : null}
      {centerValue !== undefined ? (
        <>
          <text x="50%" y="46%" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--ink-3)">
            {centerLabel}
          </text>
          <text x="50%" y="60%" textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--ink)" letterSpacing="-0.5" className="num">
            {formatMoney(centerValue, { whole: true })}
          </text>
        </>
      ) : null}
    </svg>
  );
}

/** Farbige Kategorien fuer Diagramme: eigene Farbe, sonst Diagrammpalette. */
export const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];
