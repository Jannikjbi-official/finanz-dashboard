import { Card } from "@heroui/react";
import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { LinkCard } from "@/components/shell/link-card";
import { NAV_ITEMS } from "@/components/shell/nav-items";

export const metadata: Metadata = { title: "Mehr" };

const MORE = ["/einnahmen", "/wunschliste", "/budgets", "/statistik", "/umrechner", "/einstellungen"];

export default function MorePage() {
  const items = NAV_ITEMS.filter((i) => MORE.includes(i.href));
  return (
    <Card className="gap-0 rounded-3xl p-2">
      <nav aria-label="Weitere Bereiche" className="flex flex-col">
        {items.map((item) => (
          <LinkCard key={item.href} href={item.href}>
            <span className="flex size-10 items-center justify-center rounded-2xl bg-accent/12 text-accent" aria-hidden="true">
              <item.icon className="size-5" />
            </span>
            <span className="flex-1 font-medium">{item.label}</span>
            <ChevronRight className="size-4 text-muted" aria-hidden="true" />
          </LinkCard>
        ))}
      </nav>
    </Card>
  );
}
