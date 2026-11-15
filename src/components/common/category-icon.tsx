import {
  Baby,
  Bike,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  Circle,
  CircleEllipsis,
  Coffee,
  Dog,
  Dumbbell,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  type LucideIcon,
  Music,
  PartyPopper,
  Pill,
  Plane,
  Receipt,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tv,
  UtensilsCrossed,
  Wifi,
  Wrench,
} from "lucide-react";

/** Auswählbare Icons für Kategorien (Schlüssel werden in der DB gespeichert). */
export const CATEGORY_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  "shopping-cart": { icon: ShoppingCart, label: "Einkaufswagen" },
  utensils: { icon: UtensilsCrossed, label: "Besteck" },
  coffee: { icon: Coffee, label: "Kaffee" },
  bus: { icon: Bus, label: "Bus" },
  car: { icon: Car, label: "Auto" },
  fuel: { icon: Fuel, label: "Tanken" },
  bike: { icon: Bike, label: "Fahrrad" },
  plane: { icon: Plane, label: "Reisen" },
  party: { icon: PartyPopper, label: "Freizeit" },
  gamepad: { icon: Gamepad2, label: "Gaming" },
  film: { icon: Film, label: "Kino" },
  tv: { icon: Tv, label: "Streaming" },
  music: { icon: Music, label: "Musik" },
  "shopping-bag": { icon: ShoppingBag, label: "Shopping" },
  shirt: { icon: Shirt, label: "Kleidung" },
  heart: { icon: HeartPulse, label: "Gesundheit" },
  pill: { icon: Pill, label: "Apotheke" },
  dumbbell: { icon: Dumbbell, label: "Sport" },
  home: { icon: Home, label: "Wohnen" },
  wifi: { icon: Wifi, label: "Internet" },
  smartphone: { icon: Smartphone, label: "Handy" },
  laptop: { icon: Laptop, label: "Technik" },
  wrench: { icon: Wrench, label: "Reparatur" },
  book: { icon: BookOpen, label: "Bücher" },
  education: { icon: GraduationCap, label: "Bildung" },
  work: { icon: Briefcase, label: "Arbeit" },
  gift: { icon: Gift, label: "Geschenke" },
  pet: { icon: Dog, label: "Haustier" },
  baby: { icon: Baby, label: "Kinder" },
  receipt: { icon: Receipt, label: "Rechnung" },
  sparkles: { icon: Sparkles, label: "Pflege" },
  dots: { icon: CircleEllipsis, label: "Sonstiges" },
};

export function CategoryIcon({
  icon,
  color,
  size = "md",
  className = "",
}: {
  icon: string;
  color: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[icon]?.icon ?? Circle;
  const box = size === "sm" ? "size-8 rounded-xl" : size === "lg" ? "size-12 rounded-2xl" : "size-10 rounded-2xl";
  const glyph = size === "sm" ? "size-4" : size === "lg" ? "size-6" : "size-5";
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center ${box} ${className}`}
      style={{ backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`, color }}
    >
      <Icon className={glyph} strokeWidth={2.2} />
    </span>
  );
}
