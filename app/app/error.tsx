"use client";

import Link from "next/link";
import { Button, buttonClass } from "@/ui/button";

/**
 * Fehlerzustand im eingeloggten Bereich. Zeigt keine technischen Details -
 * die Kennung hilft beim Nachvollziehen, ohne Daten preiszugeben.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-xl py-10">
      <p className="text-[13px] text-ink-3">Etwas ist schiefgelaufen</p>
      <h1 className="mt-1 font-serif text-[30px] leading-tight">Diese Ansicht konnte nicht geladen werden.</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
        Deine Daten sind davon nicht betroffen. Versuch es noch einmal – meist hilft das schon.
      </p>
      <div className="mt-6 flex gap-2">
        <Button variant="primary" onClick={reset}>
          Erneut versuchen
        </Button>
        <Link href="/app" className={buttonClass("ghost")}>
          Zur Lage
        </Link>
      </div>
      {error.digest ? <p className="num mt-6 text-[12px] text-ink-3">Kennung: {error.digest}</p> : null}
    </div>
  );
}
