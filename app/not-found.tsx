import Link from "next/link";
import { Wordmark } from "@/ui/logo";
import { buttonClass } from "@/ui/button";

export const metadata = { title: "Nicht gefunden" };

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-8">
      <Link href="/" aria-label="Zur Startseite">
        <Wordmark />
      </Link>
      <div className="flex flex-1 flex-col justify-center py-16">
        <p className="num text-[13px] text-ink-3">404</p>
        <h1 className="mt-1 font-serif text-[34px] leading-tight">Diese Seite gibt es nicht.</h1>
        <p className="mt-3 text-[15px] text-ink-2">Vielleicht ein alter Link oder ein Tippfehler in der Adresse.</p>
        <div className="mt-6 flex gap-2">
          <Link href="/app" className={buttonClass("primary")}>
            Zur Lage
          </Link>
          <Link href="/" className={buttonClass("ghost")}>
            Zur Startseite
          </Link>
        </div>
      </div>
    </div>
  );
}
