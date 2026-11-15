"use client";

import { Button, type ButtonProps } from "@heroui/react";
import { useRouter } from "next/navigation";

/** HeroUI-Button, der per Next-Router navigiert. */
export function LinkButton({ href, ...props }: ButtonProps & { href: string }) {
  const router = useRouter();
  return <Button {...props} onPress={() => router.push(href)} />;
}
