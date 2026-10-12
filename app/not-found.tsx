import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="text-center">
        <p className="label">404</p>
        <h1 className="mt-1 text-lg font-semibold">Diese Seite gibt es nicht</h1>
        <Link href="/" className="mt-4 inline-block text-muted underline decoration-border underline-offset-4 hover:text-foreground">
          Zur Übersicht
        </Link>
      </div>
    </main>
  );
}
