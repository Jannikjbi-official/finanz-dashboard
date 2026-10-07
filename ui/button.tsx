import Link from "next/link";
import { forwardRef } from "react";
import { cx } from "./cx";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "link";
type Size = "sm" | "md";

const base =
  "inline-flex shrink-0 select-none items-center justify-center gap-1.5 rounded-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-45";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover",
  secondary: "border border-line-strong bg-surface text-ink hover:border-ink-3",
  ghost: "text-ink-2 hover:bg-sunken hover:text-ink",
  danger: "border border-neg/40 text-neg hover:bg-neg-soft",
  link: "text-accent underline-offset-4 hover:underline",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-[13px]",
  md: "h-10 px-3.5 text-[14px]",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md", className?: string) {
  return cx(base, variants[variant], variant === "link" ? "h-auto px-0" : sizes[size], className);
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  pending?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", pending, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...rest}
    >
      {pending ? <Spinner /> : null}
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        "inline-block size-3.5 animate-spin rounded-full border-[1.5px] border-current border-r-transparent",
        className,
      )}
    />
  );
}
