"use client";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-16">
      <div className="panel p-6">
        <h1 className="text-lg font-semibold">Die Seite konnte nicht geladen werden</h1>
        <p className="mt-1 text-muted">
          Meist ist die Datenbank kurz nicht erreichbar. Deine Daten sind davon nicht betroffen.
          {error.digest && <span className="label mt-2 block font-normal">Fehlerkennung: {error.digest}</span>}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 inline-flex h-9 items-center rounded-[var(--radius)] bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
        >
          Erneut versuchen
        </button>
      </div>
    </div>
  );
}
