/**
 * Inline statt <img>, damit das Logo die Schriftfarbe erben kann und ohne
 * zweiten Request da ist. Die Gradient-ID wird durchgereicht, weil mehrere
 * Logos auf einer Seite sonst kollidieren.
 */
export function LogoMark({
  size = 36,
  id = "logo",
  className,
}: {
  size?: number;
  id?: string;
  className?: string;
}) {
  const gradientId = `${id}-bg`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="Finanzen"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="55%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
      </defs>

      <rect width="32" height="32" rx="9" fill={`url(#${gradientId})`} />

      <rect x="7" y="18" width="4.5" height="7" rx="2.25" fill="#fff" opacity="0.55" />
      <rect x="13.75" y="14" width="4.5" height="11" rx="2.25" fill="#fff" opacity="0.78" />
      <rect x="20.5" y="9" width="4.5" height="16" rx="2.25" fill="#fff" />

      <circle
        cx="22.75"
        cy="6.25"
        r="2.75"
        fill="#22c55e"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function Logo({
  size = 36,
  id = "logo",
  subtitle,
}: {
  size?: number;
  id?: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} id={id} />
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-tight">Finanzen</p>
        {subtitle ? (
          <p className="text-tiny text-default-400">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
