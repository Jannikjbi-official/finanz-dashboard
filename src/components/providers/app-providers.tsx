"use client";

import { I18nProvider, RouterProvider, Toast } from "@heroui/react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ThemeProvider } from "./theme-provider";

declare module "react-aria-components" {
  interface RouterConfig {
    routerOptions: NonNullable<Parameters<ReturnType<typeof useRouter>["push"]>[1]>;
  }
}

export function AppProviders({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <I18nProvider locale="de-DE">
      <RouterProvider navigate={(href, opts) => router.push(href, opts)}>
        <ThemeProvider>
          {children}
          <Toast.Provider placement="top" />
        </ThemeProvider>
      </RouterProvider>
    </I18nProvider>
  );
}
