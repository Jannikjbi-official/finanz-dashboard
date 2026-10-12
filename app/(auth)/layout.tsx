import { Providers } from "@/components/providers";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <main className="flex min-h-dvh items-center justify-center px-4 py-10">
        <div className="w-full max-w-[380px]">{children}</div>
      </main>
    </Providers>
  );
}
