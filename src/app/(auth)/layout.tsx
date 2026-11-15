import type { ReactNode } from "react";

/** Gemeinsamer Hintergrund für Login & Fehlerseiten – dezente Animation. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="pt-safe pb-safe relative flex min-h-dvh items-center justify-center overflow-hidden px-4">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="animate-blob absolute -top-32 -left-24 size-[28rem] rounded-full bg-accent/25 blur-3xl" />
        <div
          className="animate-blob absolute -right-24 -bottom-32 size-[26rem] rounded-full bg-[#8a3ffc]/20 blur-3xl"
          style={{ animationDelay: "-6s" }}
        />
        <div
          className="animate-blob absolute top-1/3 left-1/2 size-[18rem] rounded-full bg-success/10 blur-3xl"
          style={{ animationDelay: "-12s" }}
        />
      </div>
      {children}
    </main>
  );
}
