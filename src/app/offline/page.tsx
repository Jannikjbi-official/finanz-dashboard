import { Card } from "@heroui/react";
import { CloudOff } from "lucide-react";
import type { Metadata } from "next";
import { RetryButton } from "./retry-button";

export const metadata: Metadata = { title: "Offline" };
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="pt-safe pb-safe flex min-h-dvh items-center justify-center px-4">
      <Card className="animate-fade-up w-full max-w-sm rounded-[2rem] p-4 text-center">
        <Card.Content className="items-center gap-4 py-6">
          <div className="flex size-16 items-center justify-center rounded-3xl bg-accent/15 text-accent">
            <CloudOff className="size-8" aria-hidden="true" />
          </div>
          <Card.Title className="text-2xl font-semibold">Du bist offline</Card.Title>
          <Card.Description>
            Keine Sorge: Ausgaben, die du offline erfasst, landen in einer Warteschlange und werden automatisch
            gespeichert, sobald du wieder Verbindung hast.
          </Card.Description>
          <RetryButton />
        </Card.Content>
      </Card>
    </main>
  );
}
