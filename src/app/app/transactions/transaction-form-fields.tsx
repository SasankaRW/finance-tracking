"use client";

import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Building2,
  CreditCard,
  Tag,
  Wallet,
} from "lucide-react";
import { formatCurrencyCode, formatMoney } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function round2(x: number) {
  return Math.round(x * 100) / 100;
}

export function accountIcon(type: string) {
  switch (type) {
    case "bank":
      return Building2;
    case "card":
      return CreditCard;
    default:
      return Wallet;
  }
}

export function AccountSelect({
  accounts,
  value,
  onChange,
  label,
  excludeId,
}: {
  accounts: any[];
  value?: string;
  onChange: (id: string) => void;
  label: string;
  excludeId?: string;
}) {
  const options = excludeId
    ? accounts.filter((a) => a.id !== excludeId)
    : accounts;

  if (!options.length) {
    return (
      <div className="rounded-2xl border border-dashed p-3 text-center text-xs text-muted-foreground">
        No accounts available
      </div>
    );
  }

  const selected = options.find((a) => a.id === value);
  const Icon = accountIcon(selected?.type ?? "");

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-11 w-full gap-2 rounded-2xl px-3">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <SelectValue placeholder={label}>{selected?.name}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((account) => {
          const currency = formatCurrencyCode(account.currency);
          return (
            <SelectItem key={account.id} value={account.id}>
              <span className="flex w-full items-center gap-2.5">
                <span className="min-w-0 flex-1 truncate font-medium">{account.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatMoney(account.balance ?? 0, currency)}
                </span>
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

export function CategorySelect({
  categories,
  value,
  onChange,
}: {
  categories: any[];
  value?: string;
  onChange: (id: string) => void;
}) {
  const selected = categories.find((c: any) => c.id === value);

  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger className="h-11 w-full gap-2 rounded-2xl px-3">
        <Tag className="h-4 w-4 shrink-0 text-muted-foreground" />
        <SelectValue placeholder="Category">{selected?.name}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {categories.map((c: any) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export const transactionTypes = [
  { value: "expense", label: "Expense", icon: ArrowDownRight, color: "text-rose-700", pill: "bg-rose-200/90 text-rose-900" },
  { value: "income", label: "Income", icon: ArrowUpRight, color: "text-emerald-700", pill: "bg-emerald-200/90 text-emerald-900" },
  { value: "transfer", label: "Transfer", icon: ArrowLeftRight, color: "text-sky-700", pill: "bg-sky-200/90 text-sky-900" },
] as const;
