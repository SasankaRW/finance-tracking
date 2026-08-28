import { differenceInDays, format, isPast, isToday, isTomorrow } from "date-fns";
import { AlertTriangle, CalendarIcon, Clock, HandCoins, Home, Repeat, type LucideIcon } from "lucide-react";

export type SubscriptionKind = "subscription" | "loan" | "rent";

export function getBillKindLabel(kind: string | undefined) {
  if (kind === "loan") return "Loan payment";
  if (kind === "rent") return "Rent";
  return "Subscription";
}

export function getBillKindIcon(kind: string | undefined): LucideIcon {
  if (kind === "loan") return HandCoins;
  if (kind === "rent") return Home;
  return Repeat;
}

export function getDueDateInfo(date: Date): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: LucideIcon;
} {
  if (isPast(date) && !isToday(date)) {
    const days = differenceInDays(new Date(), date);
    return { label: `${days}d overdue`, variant: "destructive", icon: AlertTriangle };
  }
  if (isToday(date)) {
    return { label: "Due today", variant: "default", icon: Clock };
  }
  if (isTomorrow(date)) {
    return { label: "Tomorrow", variant: "secondary", icon: Clock };
  }
  const days = differenceInDays(date, new Date());
  if (days <= 7) {
    return { label: `In ${days}d`, variant: "secondary", icon: Clock };
  }
  return { label: format(date, "MMM d"), variant: "outline", icon: CalendarIcon };
}
