"use client";

import { useActionState, useEffect } from "react";
import { Button, addToast } from "@heroui/react";
import type { ActionState } from "@/lib/actions";

const INITIAL: ActionState = { ok: true };

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  id: string;
  children: React.ReactNode;
  confirm?: string;
  color?: "default" | "primary" | "success" | "danger" | "warning";
  variant?: "solid" | "flat" | "light" | "bordered";
  size?: "sm" | "md";
  isIconOnly?: boolean;
  title?: string;
};

export function ActionButton({
  action,
  id,
  children,
  confirm,
  color = "default",
  variant = "light",
  size = "sm",
  isIconOnly,
  title,
}: Props) {
  const [state, formAction, pending] = useActionState(action, INITIAL);

  useEffect(() => {
    if (state.message) addToast({ title: state.message, color: "success" });
    if (state.error) addToast({ title: state.error, color: "danger" });
  }, [state]);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
      className="inline-flex"
    >
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        color={color}
        variant={variant}
        size={size}
        isIconOnly={isIconOnly}
        isLoading={pending}
        title={title}
        aria-label={title}
      >
        {children}
      </Button>
    </form>
  );
}
