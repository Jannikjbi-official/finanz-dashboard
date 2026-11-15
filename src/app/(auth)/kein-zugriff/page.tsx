import { Card } from "@heroui/react";
import { ShieldX } from "lucide-react";
import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/link-button";

export const metadata: Metadata = { title: "Kein Zugriff" };

export default function NoAccessPage() {
  return (
    <Card className="animate-fade-up w-full max-w-sm rounded-[2rem] p-4 text-center">
      <Card.Content className="items-center gap-4 py-6">
        <div className="flex size-16 items-center justify-center rounded-3xl bg-danger/15 text-danger">
          <ShieldX className="size-8" aria-hidden="true" />
        </div>
        <Card.Title className="text-2xl font-semibold">Kein Zugriff</Card.Title>
        <Card.Description>
          Dieser Discord-Account ist für diese App nicht freigeschaltet. Es wurde kein Konto angelegt und keine Sitzung
          gestartet.
        </Card.Description>
        <LinkButton href="/login" variant="secondary">
          Zurück zum Login
        </LinkButton>
      </Card.Content>
    </Card>
  );
}
