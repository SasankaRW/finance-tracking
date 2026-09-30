"use client";

import * as React from "react";
import Link from "next/link";
import { format, differenceInDays, endOfMonth } from "date-fns";
import { Timestamp } from "firebase/firestore";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Banknote,
  CalendarDays,
  ChevronRight,
  CreditCard,
  Eye,
  EyeOff,
  Landmark,
  type LucideIcon,
  PieChart,
  Pencil,
  Plus,
} from "lucide-react";
import { formatCurrencyCode, formatMoney, formatMoneyCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useBalanceVisibility } from "@/lib/hooks/use-balance-visibility";
import { getCategoryIcon } from "@/lib/finance/category-icons";
import { useDeleteTransactionWithUndo } from "@/lib/finance/use-delete-transaction";
import { SwipeableRow } from "@/components/swipeable-row";
import { AnimatedNumber } from "@/components/animated-number";
import { CreateTransactionDialog } from "@/app/app/transactions/create-transaction-dialog";
import { DebtPillsSummary } from "@/components/debt-pills-summary";
import { UpcomingBillsPanel } from "@/components/upcoming-bills-panel";
import { PendingImportsPanel } from "@/components/pending-imports-panel";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const PIE_COLORS = ["#22c55e", "#3b82f6", "#f97316", "#a855f7", "#ef4444", "#14b8a6"];

// Above these magnitudes, showing every digit would force text to shrink or
// clip — compact notation ("LKR 1.2M") keeps the string short at any size
// instead, which is what actually fixes the width problem long-term.
const HERO_COMPACT_THRESHOLD = 1_000_000;
const TILE_COMPACT_THRESHOLD = 100_000;

function smartMoney(amount: number, currency: string | undefined, threshold: number) {
  return Math.abs(amount) >= threshold
    ? formatMoneyCompact(amount, currency)
    : formatMoney(amount, currency);
}

// A small fixed-size safety net for the rare string compact notation doesn't
// shorten enough (e.g. an unusual currency code) — not the primary mechanism.
function heroTextSize(text: string) {
  return text.length <= 13 ? "text-[2.5rem]" : "text-[1.9rem]";
}

function tileTextSize(text: string) {
  return text.length <= 11 ? "text-[1.35rem]" : "text-[1.1rem]";
}

type CategorySpend = {
  categoryId: string;
  name: string;
  value: number;
  icon?: string;
};

type Tx = {
  id: string;
  kind: string;
  amount?: number;
  note?: string;
  occurredAt?: unknown;
  categoryId?: string;
};

type AccountSummary = {
  id: string;
  name: string;
  type?: string;
  currency?: string;
  balance?: number;
};

// One slide of the "Total → per-account" swipe carousel. Deliberately simpler
// than the Total slide (no cash chip, no days-left, no sparkline) — it's a
// quick per-account glance, not a second hero.
function AccountSlide({ account, hidden }: { account: AccountSummary; hidden: boolean }) {
  const text = smartMoney(account.balance ?? 0, account.currency, TILE_COMPACT_THRESHOLD);
  const TypeIcon = account.type === "cash" ? Banknote : account.type === "card" ? CreditCard : Landmark;

  return (
    <div className="hero-card relative h-full w-full shrink-0 snap-center overflow-hidden rounded-[2.25rem] p-5">
      <div className="hero-card-glow absolute -right-10 -top-14 h-36 w-36 rounded-full blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15">
              <TypeIcon className="h-3 w-3 text-white" />
            </span>
            <p className="truncate text-sm font-medium text-white/75">{account.name}</p>
          </div>
          <p
            className={cn(
              "mt-2 whitespace-nowrap font-display font-bold leading-tight tracking-tight text-white transition-[filter] duration-300",
              heroTextSize(text),
              hidden && "select-none blur-md",
            )}
          >
            {text}
          </p>
          <p className="mt-1 text-xs capitalize text-white/70">
            {account.type ?? "account"} · {formatCurrencyCode(account.currency)}
          </p>
        </div>
        <Link
          href="/app/accounts"
          aria-label="Manage accounts"
          className="motion-expressive press-expressive flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15 hover:rounded-full"
        >
          <Pencil className="h-4 w-4 text-white" />
        </Link>
      </div>
    </div>
  );
}

function toDate(value: unknown) {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return new Date();
}

// Small ring in place of a flat "X% used" pill — the same information, but
// legible at a glance instead of needing to read a number.
function BudgetRing({
  percent,
  tone,
  className,
}: {
  percent: number;
  tone: "ok" | "warning" | "over";
  className?: string;
}) {
  const size = 36;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(percent, 0), 100);
  const offset = circumference * (1 - clamped / 100);
  const color = tone === "over" ? "#e11d48" : tone === "warning" ? "#d97706" : "#059669";

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.18}
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-[stroke-dashoffset] duration-500 ease-ios"
      />
    </svg>
  );
}

export function DashboardMinusMobile({
  isLoading,
  budgetOver,
  budgetWarning,
  budgetPercentUsed,
  budgetStatus,
  totalBalance,
  balanceCurrency,
  balanceMissingRate,
  accountCount,
  recentTransactions,
  categoryNameById,
  categoryIconById,
  expenseByCategory,
  usdToLkr,
  cashInHand,
  cashMissingRate,
  accounts,
}: {
  isLoading: boolean;
  budgetOver: boolean;
  budgetWarning: boolean;
  budgetPercentUsed: number | null;
  budgetStatus: {
    overallLimit: number | null;
    overallCurrency: string;
    totalSpent: number;
  };
  totalBalance: number;
  balanceCurrency: string;
  balanceMissingRate: boolean;
  accountCount: number;
  recentTransactions: Tx[];
  categoryNameById: Map<string, string>;
  categoryIconById: Map<string, LucideIcon>;
  expenseByCategory: CategorySpend[];
  usdToLkr?: number | null;
  cashInHand?: number;
  cashMissingRate?: boolean;
  accounts?: AccountSummary[];
}) {
  const [categoryDialogOpen, setCategoryDialogOpen] = React.useState(false);
  const { hidden: balanceHidden, toggle: toggleBalanceHidden } = useBalanceVisibility();
  const deleteWithUndo = useDeleteTransactionWithUndo();
  const daysLeft = differenceInDays(endOfMonth(new Date()), new Date()) + 1;

  // "Total" plus one slide per account — a horizontal scroll-snap carousel
  // rather than a gesture library, so momentum/rubber-banding is free and
  // native. Tracks which slide is active from scroll position for the dots.
  // Accounts excluded from totals ("hidden" in Settings → Accounts) stay out
  // of the swipe carousel too — showing them here would defeat the point of
  // excluding them in the first place.
  const heroSlides = (accounts ?? []).filter((a: any) => a.includeInTotals !== false);
  const slideCount = 1 + heroSlides.length;
  const heroScrollerRef = React.useRef<HTMLDivElement>(null);
  const heroSlideRefs = React.useRef<Array<HTMLDivElement | null>>([]);
  const [activeSlide, setActiveSlide] = React.useState(0);

  // Depth through motion, not just a static shadow: each slide continuously
  // scales down and dims as it moves away from center, so swiping through
  // the carousel feels like flipping through cards angled slightly into the
  // screen rather than a flat filmstrip snapping between equal frames. Read
  // via a direct DOM write (not React state) since this runs on every scroll
  // frame — routing it through a re-render would be needless work and could
  // visibly lag behind the finger.
  const handleHeroScroll = () => {
    const el = heroScrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    const rawPosition = el.scrollLeft / el.clientWidth;

    const idx = Math.round(rawPosition);
    setActiveSlide((current) => (current === idx ? current : idx));

    heroSlideRefs.current.forEach((node, i) => {
      if (!node) return;
      const distance = Math.min(1, Math.abs(rawPosition - i));
      const scale = 1 - distance * 0.08;
      const opacity = 1 - distance * 0.45;
      node.style.transform = `scale(${scale})`;
      node.style.opacity = String(opacity);
    });
  };
  const availablePct =
    budgetStatus.overallLimit && budgetPercentUsed !== null
      ? Math.max(0, 100 - budgetPercentUsed)
      : null;

  const todayTotal = React.useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    let total = 0;
    for (const t of recentTransactions) {
      const d = format(toDate(t.occurredAt), "yyyy-MM-dd");
      if (d === today && t.kind === "expense") total += t.amount ?? 0;
    }
    return total;
  }, [recentTransactions]);

  const balanceText = balanceMissingRate
    ? "—"
    : smartMoney(totalBalance, balanceCurrency, HERO_COMPACT_THRESHOLD);
  const dailyText = smartMoney(todayTotal, undefined, TILE_COMPACT_THRESHOLD);
  const monthlyText = smartMoney(budgetStatus.totalSpent, undefined, TILE_COMPACT_THRESHOLD);
  const cashText = cashMissingRate
    ? "—"
    : smartMoney(cashInHand ?? 0, balanceCurrency, TILE_COMPACT_THRESHOLD);

  const todayTx = React.useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return recentTransactions
      .filter((t) => format(toDate(t.occurredAt), "yyyy-MM-dd") === today)
      .slice(0, 8);
  }, [recentTransactions]);

  return (
    <div className="space-y-3 md:hidden">
      <div className="flex items-center justify-between gap-3">
        {isLoading ? (
          <Skeleton className="h-12 flex-1 rounded-full" />
        ) : budgetPercentUsed !== null ? (
          <div
            className={`flex flex-1 items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 ${
              budgetOver
                ? "bg-rose-200/80 text-rose-900"
                : budgetWarning
                  ? "bg-amber-200/80 text-amber-900"
                  : "bg-emerald-200/80 text-emerald-900"
            }`}
          >
            <BudgetRing
              percent={budgetPercentUsed}
              tone={budgetOver ? "over" : budgetWarning ? "warning" : "ok"}
              className="shrink-0"
            />
            <span className="text-sm font-bold">
              {budgetOver
                ? "Budget exhausted"
                : budgetWarning
                  ? `${budgetPercentUsed}% used`
                  : "Budget on track"}
            </span>
          </div>
        ) : (
          <div className="flex-1 rounded-full bg-muted px-4 py-2.5 text-sm font-medium text-muted-foreground">
            No budget set
          </div>
        )}
        <Link
          href="/app/budgets"
          className="motion-expressive press-expressive flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground hover:rounded-full"
          aria-label="Budget stats"
        >
          <BarChart3 className="h-5 w-5" />
        </Link>
      </div>

      {isLoading ? (
        // Shaped like the real hero card + tile grid (same gradient, radius,
        // padding and line positions) so content lands where the placeholder
        // was instead of jumping. Opacity pulse only — no animated backgrounds.
        <div className="space-y-3" aria-hidden="true">
          <div className="px-1.5">
            <div className="hero-card relative overflow-hidden rounded-[2.25rem] p-5">
              <div className="animate-pulse">
                <div className="h-3.5 w-16 rounded-full bg-white/20" />
                <div className="mt-3 h-9 w-44 rounded-xl bg-white/25" />
                <div className="mt-2.5 h-3 w-36 rounded-full bg-white/15" />
                <div className="mt-4 flex items-center justify-between border-t border-white/15 pt-3">
                  <div className="h-7 w-28 rounded-full bg-white/15" />
                  <div className="h-7 w-20 rounded-full bg-white/20" />
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[0, 1].map((i) => (
              <div
                key={i}
                className={`elevation-1 animate-pulse rounded-[1.75rem] bg-card px-3.5 py-4 ${
                  i === 0 ? "rounded-br-lg" : "rounded-bl-lg"
                }`}
              >
                <div className="h-3 w-20 rounded-full bg-muted" />
                <div className="mt-3 h-6 w-24 rounded-lg bg-muted" />
                <div className="mt-3 h-2.5 w-12 rounded-full bg-muted/70" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div
            ref={heroScrollerRef}
            onScroll={handleHeroScroll}
            // animate-ios-fade (opacity only), not animate-ios-in: a transform on
            // this ancestor — even transient, even settled at scale(1) — is what
            // was still promoting the rounded card inside it to its own composited
            // layer and reviving the corner-clip bug after it was removed from the
            // card itself.
            className="scrollbar-hide animate-ios-fade flex snap-x snap-mandatory overflow-x-auto"
          >
          {/* px-1.5 (not a scroller gap) so the outer box driving scroll-snap
              stays exactly 100% of the scroller — a real `gap` would offset
              the snap math and break "one card per swipe". The inset just
              keeps adjacent cards from touching mid-scroll. */}
          <div
            ref={(node) => {
              heroSlideRefs.current[0] = node;
            }}
            className="w-full shrink-0 snap-center px-1.5"
            style={{ transformOrigin: "center" }}
          >
          <div className="hero-card relative overflow-hidden rounded-[2.25rem] p-5">
            <div className="hero-card-glow absolute -right-10 -top-14 h-36 w-36 rounded-full blur-2xl" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white/75">Balance</p>
                  <button
                    type="button"
                    onClick={toggleBalanceHidden}
                    aria-label={balanceHidden ? "Show balance" : "Hide balance"}
                    className="motion-expressive press-expressive flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70"
                  >
                    {balanceHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <p
                  className={cn(
                    "mt-1 whitespace-nowrap font-display font-bold leading-tight tracking-tight text-white transition-[filter] duration-300",
                    heroTextSize(balanceText),
                    balanceHidden && "select-none blur-md",
                  )}
                >
                  {balanceMissingRate ? (
                    "—"
                  ) : (
                    <AnimatedNumber
                      value={totalBalance}
                      formatFn={(v) => smartMoney(v, balanceCurrency, HERO_COMPACT_THRESHOLD)}
                    />
                  )}
                </p>
                <p className="mt-1 text-xs text-white/70">
                  {balanceMissingRate
                    ? "USD rate unavailable"
                    : `Across ${accountCount} account${accountCount !== 1 ? "s" : ""}${
                        availablePct !== null ? ` · ${availablePct}% budget left` : ""
                      }`}
                </p>
                {typeof usdToLkr === "number" && (
                  <p className="mt-0.5 text-xs text-white/60">
                    1 USD = {usdToLkr.toFixed(2)} {balanceCurrency}
                  </p>
                )}
              </div>
              <Link
                href="/app/budgets"
                aria-label="Edit budget"
                className="motion-expressive press-expressive flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15 hover:rounded-full"
              >
                <Pencil className="h-4 w-4 text-white" />
              </Link>
            </div>

            <div className="relative mt-4 flex items-center justify-between gap-3 border-t border-white/15 pt-3">
              <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-white/15 py-1.5 pl-2.5 pr-3.5 text-xs text-white">
                <Banknote className="h-3.5 w-3.5 shrink-0 text-white/80" />
                <span className="shrink-0 text-white/75">Cash</span>
                <span
                  className={cn(
                    "truncate font-display font-bold tabular-nums transition-[filter] duration-300",
                    balanceHidden && "select-none blur-sm",
                  )}
                >
                  {cashMissingRate ? (
                    "—"
                  ) : (
                    <AnimatedNumber
                      value={cashInHand ?? 0}
                      formatFn={(v) => smartMoney(v, balanceCurrency, TILE_COMPACT_THRESHOLD)}
                    />
                  )}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-white/20 px-3.5 py-1.5 font-display text-xs font-bold text-white">
                {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
              </span>
            </div>
          </div>
          </div>

          {heroSlides.map((account, i) => (
            <div
              key={account.id}
              ref={(node) => {
                heroSlideRefs.current[i + 1] = node;
              }}
              className="w-full shrink-0 snap-center px-1.5"
              style={{ transformOrigin: "center" }}
            >
              <AccountSlide account={account} hidden={balanceHidden} />
            </div>
          ))}
          </div>

          {slideCount > 1 && (
            <div className="flex items-center justify-center gap-1.5 py-1">
              {Array.from({ length: slideCount }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300 ease-ios",
                    i === activeSlide ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30",
                  )}
                />
              ))}
            </div>
          )}

          {/* Label-first tiles so a long amount gets a full line of its own and never
              runs under the chevron. Each caption carries a small icon so these read
              as part of the same system as the panels below, not a separate style. */}
          <div className="animate-ios-in grid grid-cols-2 items-stretch gap-3 delay-75">
            <div className="motion-expressive elevation-1 flex min-w-0 flex-col rounded-[1.75rem] rounded-br-lg bg-secondary px-3.5 py-4 text-secondary-foreground">
              <div className="flex h-5 items-center gap-1.5">
                <CalendarDays className="h-3 w-3 shrink-0 opacity-60" />
                <p className="truncate text-[11px] font-semibold uppercase tracking-wide opacity-70">
                  Daily spend
                </p>
              </div>
              <p
                className={cn(
                  "mt-1.5 whitespace-nowrap font-display font-bold leading-tight tabular-nums",
                  tileTextSize(dailyText),
                )}
              >
                <AnimatedNumber value={todayTotal} formatFn={(v) => smartMoney(v, undefined, TILE_COMPACT_THRESHOLD)} />
              </p>
              <p className="mt-auto pt-1 text-[11px] opacity-65">{format(new Date(), "MMM d")}</p>
            </div>

            <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="tonal-primary motion-expressive press-expressive elevation-1 flex w-full min-w-0 flex-col rounded-[1.75rem] rounded-bl-lg px-3.5 py-4 text-left"
                >
                  <div className="flex h-5 items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <PieChart className="h-3 w-3 shrink-0 opacity-60" />
                      <p className="truncate text-[11px] font-semibold uppercase tracking-wide opacity-70">
                        Monthly spend
                      </p>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
                  </div>
                  <p
                    className={cn(
                      "mt-1.5 whitespace-nowrap font-display font-bold leading-tight tabular-nums",
                      tileTextSize(monthlyText),
                    )}
                  >
                    <AnimatedNumber
                      value={budgetStatus.totalSpent}
                      formatFn={(v) => smartMoney(v, undefined, TILE_COMPACT_THRESHOLD)}
                    />
                  </p>
                  <p className="mt-auto pt-1 text-[11px] opacity-65">tap for breakdown</p>
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Spending by category</DialogTitle>
                  <DialogDescription>
                    {format(new Date(), "MMMM yyyy")} · {formatMoney(budgetStatus.totalSpent)} spent
                  </DialogDescription>
                </DialogHeader>
                <DialogBody className="pb-4">
                  {expenseByCategory.length > 0 ? (
                    <ul className="-mx-1">
                      {expenseByCategory.map((cat, idx) => {
                        const pct =
                          budgetStatus.totalSpent > 0
                            ? Math.round((cat.value / budgetStatus.totalSpent) * 100)
                            : 0;
                        const color = PIE_COLORS[idx % PIE_COLORS.length];
                        const CatIcon = getCategoryIcon({ name: cat.name, icon: cat.icon, kind: "expense" });
                        // "uncategorized" is a synthetic bucket, not a real category id.
                        const href =
                          cat.categoryId === "uncategorized"
                            ? "/app/transactions"
                            : `/app/transactions?categoryId=${encodeURIComponent(cat.categoryId)}`;
                        return (
                          <li key={cat.categoryId}>
                            <Link
                              href={href}
                              onClick={() => setCategoryDialogOpen(false)}
                              className="motion-expressive flex items-center gap-3 rounded-xl px-1 py-2 active:bg-muted/60"
                            >
                              <span
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                                style={{ backgroundColor: `${color}22`, color }}
                              >
                                <CatIcon className="h-4 w-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-baseline justify-between gap-2">
                                  <span className="truncate text-sm font-medium">{cat.name}</span>
                                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                                    {formatMoney(cat.value)}
                                  </span>
                                </span>
                                <span className="mt-1.5 flex items-center gap-2">
                                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                    <span
                                      className="block h-full rounded-full"
                                      style={{ width: `${pct}%`, backgroundColor: color }}
                                    />
                                  </span>
                                  <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                                    {pct}%
                                  </span>
                                </span>
                              </span>
                              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      No expenses recorded yet this month.
                    </div>
                  )}
                </DialogBody>
              </DialogContent>
            </Dialog>
          </div>
        </>
      )}

      <PendingImportsPanel />

      <UpcomingBillsPanel />

      <DebtPillsSummary />

      <div className="space-y-2">
        <div className="animate-ios-in flex items-center justify-between px-1 delay-150">
          <span className="flex items-center gap-2 font-display text-base font-bold">
            <span className="h-4 w-1 rounded-full bg-primary" aria-hidden="true" />
            Today
          </span>
          <div className="flex items-center gap-2">
            {todayTx.length > 0 && (
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground tabular-nums">
                {formatMoney(todayTotal)}
              </span>
            )}
            <Link
              href="/app/transactions"
              className="flex items-center gap-0.5 text-xs font-semibold text-muted-foreground"
            >
              All
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-[1.75rem] bg-card elevation-1">
          {isLoading ? (
            <ul className="animate-pulse" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <li
                  key={i}
                  className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-border/50" : ""}`}
                >
                  <span className="h-8 w-8 shrink-0 rounded-xl bg-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="h-3.5 w-28 rounded-full bg-muted" />
                    <div className="mt-1.5 h-2.5 w-16 rounded-full bg-muted/70" />
                  </div>
                  <div className="h-3.5 w-14 shrink-0 rounded-full bg-muted" />
                </li>
              ))}
            </ul>
          ) : todayTx.length ? (
            <ul>
              {todayTx.map((t, idx) => {
                const category = categoryNameById.get(t.categoryId ?? "");
                const name =
                  t.note?.trim() || category || (t.kind === "income" ? "Income" : "Expense");
                const time = format(toDate(t.occurredAt), "HH:mm");
                const isIncome = t.kind === "income";
                const RowIcon: LucideIcon =
                  t.kind === "transfer"
                    ? ArrowUpRight
                    : (categoryIconById.get(t.categoryId ?? "") ??
                      (isIncome ? ArrowUpRight : ArrowDownRight));
                return (
                  <li
                    key={t.id}
                    className={`animate-ios-in ${idx > 0 ? "border-t border-border/50" : ""}`}
                    style={{ animationDelay: `${180 + Math.min(idx, 6) * 35}ms` }}
                  >
                    <SwipeableRow onDelete={() => void deleteWithUndo(t)}>
                      <div className="flex items-center gap-3 px-4 py-2.5">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                            isIncome ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                          }`}
                        >
                          <RowIcon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold leading-tight">{name}</p>
                          <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">
                            {time}
                            {category && name !== category ? ` · ${category}` : ""}
                          </p>
                        </div>
                        <p
                          className={`shrink-0 text-sm font-bold tabular-nums ${
                            isIncome ? "text-emerald-600 dark:text-emerald-400" : ""
                          }`}
                        >
                          {isIncome ? "+" : "-"}
                          {formatMoney(t.amount ?? 0)}
                        </p>
                      </div>
                    </SwipeableRow>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No transactions today yet.</p>
              <CreateTransactionDialog
                trigger={
                  <button
                    type="button"
                    className="motion-expressive press-expressive flex items-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-xs font-bold text-secondary-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add transaction
                  </button>
                }
              />
            </div>
          )}
        </div>
      </div>

      <div className="pb-24" />
    </div>
  );
}
