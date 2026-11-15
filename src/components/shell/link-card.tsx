"use client";

import { Link } from "@heroui/react";
import type { ReactNode } from "react";

/** Große, gut tippbare Listen-Zeile (≥ 56 px) als Link. */
export function LinkCard({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2 text-foreground no-underline transition-colors hover:bg-default data-[hovered=true]:bg-default data-[pressed=true]:bg-default"
    >
      {children}
    </Link>
  );
}
