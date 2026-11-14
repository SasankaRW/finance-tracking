"use client";

import * as React from "react";
import {
  Baby,
  Book,
  Briefcase,
  Bus,
  Car,
  Coffee,
  Dumbbell,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  Home,
  type LucideIcon,
  Music,
  PawPrint,
  Percent,
  PiggyBank,
  Pill,
  Plane,
  Scissors,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tag,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
  Wifi,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

// A curated set rather than "every Lucide icon" — small enough to browse in a
// picker grid, broad enough to cover common expense/income categories without
// forcing everything into a generic tag.
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  cart: ShoppingCart,
  bag: ShoppingBag,
  home: Home,
  utilities: Wifi,
  car: Car,
  bus: Bus,
  fuel: Fuel,
  dining: UtensilsCrossed,
  coffee: Coffee,
  subscription: Smartphone,
  health: HeartPulse,
  pill: Pill,
  film: Film,
  game: Gamepad2,
  music: Music,
  book: Book,
  travel: Plane,
  education: GraduationCap,
  fitness: Dumbbell,
  pet: PawPrint,
  baby: Baby,
  clothing: Shirt,
  grooming: Scissors,
  tool: Wrench,
  gift: Gift,
  briefcase: Briefcase,
  salary: Wallet,
  invest: TrendingUp,
  interest: Percent,
  savings: PiggyBank,
  borrowed: HandCoins,
  tag: Tag,
  sparkles: Sparkles,
};

// Category name (lowercased) -> icon key, so categories created before icons
// existed — and the built-in default categories — still get a sensible icon
// with zero configuration.
const NAME_DEFAULTS: Record<string, string> = {
  salary: "salary",
  bonus: "gift",
  freelance: "briefcase",
  interest: "interest",
  gift: "gift",
  groceries: "cart",
  "rent / mortgage": "home",
  rent: "home",
  mortgage: "home",
  utilities: "utilities",
  transportation: "car",
  transport: "car",
  dining: "dining",
  food: "dining",
  shopping: "bag",
  subscriptions: "subscription",
  healthcare: "health",
  health: "health",
  entertainment: "film",
  education: "education",
  travel: "travel",
  fitness: "fitness",
  pets: "pet",
  pet: "pet",
};

export function getCategoryIconKey(category: {
  name?: string;
  icon?: string;
  kind?: string;
}): string {
  if (category.icon && CATEGORY_ICONS[category.icon]) return category.icon;
  const byName = NAME_DEFAULTS[(category.name ?? "").trim().toLowerCase()];
  if (byName) return byName;
  return category.kind === "income" ? "salary" : "tag";
}

export function getCategoryIcon(category: {
  name?: string;
  icon?: string;
  kind?: string;
}): LucideIcon {
  return CATEGORY_ICONS[getCategoryIconKey(category)] ?? Tag;
}

export function CategoryIconPicker({
  value,
  onChange,
  className,
}: {
  value?: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-6 gap-2", className)}>
      {Object.entries(CATEGORY_ICONS).map(([key, Icon]) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-label={key}
            aria-pressed={selected}
            className={cn(
              "motion-expressive press-expressive flex h-10 w-10 items-center justify-center rounded-xl",
              selected
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            <Icon className="h-4.5 w-4.5" />
          </button>
        );
      })}
    </div>
  );
}
