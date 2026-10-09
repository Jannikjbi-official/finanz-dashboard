"use client";

import { useTransition } from "react";
import type { ActionState } from "@/lib/actions";
import { Button } from "./button";
import { useToast } from "./toast";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/** Ein Knopf, der eine Server Action mit festen Feldern ausloest. */
export function ActionButton({
  action,
  fields,
  children,
  variant = "secondary",
  size = "sm",
  className,
  onDone,
  "aria-label": ariaLabel,
}: {
  action: Action;
  fields: Record<string, string>;
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  onDone?: () => void;
  "aria-label"?: string;
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      pending={pending}
      aria-label={ariaLabel}
      onClick={(event) => {
        event.stopPropagation();
        startTransition(async () => {
          const data = new FormData();
          for (const [key, value] of Object.entries(fields)) data.set(key, value);
          const result = await action({ ok: false }, data);
          if (result.ok) {
            if (result.message) toast(result.message);
            onDone?.();
          } else toast(result.error ?? "Das hat nicht geklappt", "error");
        });
      }}
    >
      {children}
    </Button>
  );
}
