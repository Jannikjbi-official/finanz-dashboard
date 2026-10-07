import Link from "next/link";
import { Wordmark } from "@/ui/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-[1120px] items-center px-5 sm:px-8">
        <Link href="/" aria-label="Zur Startseite">
          <Wordmark />
        </Link>
      </header>
      <main id="inhalt" className="flex flex-1 items-start justify-center px-5 pb-16 pt-10 sm:pt-20">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
      <footer className="flex justify-center gap-5 pb-8 text-[12px] text-ink-3">
        <Link href="/impressum" className="hover:text-ink">
          Impressum
        </Link>
        <Link href="/datenschutz" className="hover:text-ink">
          Datenschutz
        </Link>
      </footer>
    </div>
  );
}
