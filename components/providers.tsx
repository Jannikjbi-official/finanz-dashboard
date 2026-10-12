"use client";

import { I18nProvider, Toast } from "@heroui/react";

/** Deutsche Zahlen- und Datumsformate fuer alle HeroUI-Felder, Toasts global. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider locale="de-DE">
      {children}
      <Toast.Provider placement="bottom end" maxVisibleToasts={3} />
    </I18nProvider>
  );
}
