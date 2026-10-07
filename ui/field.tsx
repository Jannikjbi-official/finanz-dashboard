"use client";

import { forwardRef, useId } from "react";
import { cx } from "./cx";

const control =
  "w-full rounded-sm border border-line-strong bg-surface px-3 text-[14px] text-ink placeholder:text-ink-3 transition-colors hover:border-ink-3 focus:border-accent focus:outline-none disabled:opacity-50";

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
  optional,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
  optional?: boolean;
}) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 text-[13px] font-medium text-ink-2">
        <span>{label}</span>
        {optional ? <span className="text-[12px] font-normal text-ink-3">optional</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-[12px] text-neg">{error}</p>
      ) : hint ? (
        <p className="text-[12px] leading-snug text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cx(control, "h-10", className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cx(control, "min-h-20 py-2 leading-snug", className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <div className="relative">
        <select ref={ref} className={cx(control, "h-10 appearance-none pr-8", className)} {...rest}>
          {children}
        </select>
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          className="pointer-events-none absolute right-3 top-1/2 size-3 -translate-y-1/2 text-ink-3"
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </div>
    );
  },
);

/** Betragsfeld: Komma-Eingabe, Ziffernblock auf dem Handy, Euro-Zeichen rechts. */
export const AmountInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function AmountInput({ className, ...rest }, ref) {
    return (
      <div className="relative">
        <input
          ref={ref}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          className={cx(control, "num h-10 pr-8 text-right", className)}
          {...rest}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-ink-3">€</span>
      </div>
    );
  },
);

/** Umschalter fuer wenige, sich ausschliessende Optionen (als Radiogruppe). */
export function Segmented<T extends string>({
  name,
  options,
  value,
  defaultValue,
  onChange,
  className,
  size = "md",
}: {
  name: string;
  options: Array<{ value: T; label: string }>;
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      className={cx("inline-flex rounded-sm border border-line-strong bg-surface p-0.5", className)}
    >
      {options.map((option) => {
        const inputId = `${id}-${option.value}`;
        return (
          <label key={option.value} htmlFor={inputId} className="relative flex-1 cursor-pointer">
            <input
              id={inputId}
              type="radio"
              name={name}
              value={option.value}
              className="peer sr-only"
              checked={value !== undefined ? value === option.value : undefined}
              defaultChecked={value === undefined ? defaultValue === option.value : undefined}
              onChange={() => onChange?.(option.value)}
            />
            <span
              className={cx(
                "flex items-center justify-center whitespace-nowrap rounded-xs px-3 font-medium text-ink-2 transition-colors peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-focus",
                size === "sm" ? "h-7 text-[12px]" : "h-8 text-[13px]",
              )}
            >
              {option.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function Checkbox({
  label,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className={cx("flex cursor-pointer items-start gap-2.5 text-[14px] text-ink-2", className)}>
      <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" {...rest} />
      <span>{label}</span>
    </label>
  );
}
