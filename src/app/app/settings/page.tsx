"use client";

import * as React from "react";
import Link from "next/link";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Wallet,
  Building2,
  CreditCard,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  PiggyBank,
  EyeOff,
  Lock,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-provider";
import { useAccounts } from "@/lib/finance/hooks";
import { createAccount } from "@/lib/finance/mutations";
import { updateAccount, deleteAccount } from "@/lib/finance/account-mutations";
import { formatCurrencyCode, formatMoney } from "@/lib/format";
import { COMMON_CURRENCIES, DEFAULT_CURRENCY, HOME_CURRENCY } from "@/shared/currency";
import { useFxRates } from "@/lib/fx/use-fx-rates";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resetPassword } from "@/lib/auth/auth-actions";

const createSchema = z.object({
  name: z.string().min(1).max(64),
  type: z.enum(["cash", "bank", "card"]),
  currency: z.string().min(3).max(3),
  initialBalance: z.number().finite(),
  includeInTotals: z.boolean(),
});

type CreateValues = z.infer<typeof createSchema>;

const updateSchema = z.object({
  accountId: z.string().min(1),
  name: z.string().min(1).max(64),
  type: z.enum(["cash", "bank", "card"]),
  currency: z.string().min(3).max(3),
  balance: z.number().finite(),
  includeInTotals: z.boolean(),
});
type UpdateValues = z.infer<typeof updateSchema>;

const accountTypes = [
  { value: "cash", label: "Cash", icon: Wallet, description: "Physical currency" },
  { value: "bank", label: "Bank", icon: Building2, description: "Bank account" },
  { value: "card", label: "Card", icon: CreditCard, description: "Credit/Debit" },
] as const;

const getAccountIcon = (type: string) => {
  switch (type) {
    case "cash":
      return <Wallet className="h-4 w-4" />;
    case "bank":
      return <Building2 className="h-4 w-4" />;
    case "card":
      return <CreditCard className="h-4 w-4" />;
    default:
      return <Wallet className="h-4 w-4" />;
  }
};

export default function AccountsPage() {
  const { user } = useAuth();
  const { accounts, loading } = useAccounts();
  const { data: fxUsd, isLoading: fxLoading } = useFxRates("USD", [HOME_CURRENCY]);
  const usdToLkr = fxUsd?.rates?.[HOME_CURRENCY] ?? null;

  const { totalBalanceLkr, hasUnsupportedCurrency, missingUsdRate } =
    React.useMemo(() => {
      let total = 0;
      let unsupported = false;
      let missingRate = false;
      for (const a of accounts as any[]) {
        if (a.includeInTotals === false) continue;
        const bal = a.balance ?? 0;
        const cur = formatCurrencyCode(a.currency);
        if (cur === HOME_CURRENCY) {
          total += bal;
        } else if (cur === "USD") {
          if (typeof usdToLkr === "number") total += bal * usdToLkr;
          else missingRate = true;
        } else {
          unsupported = true;
        }
      }
      return {
        totalBalanceLkr: total,
        hasUnsupportedCurrency: unsupported,
        missingUsdRate: missingRate,
      };
    }, [accounts, usdToLkr]);

  const accountCounts = React.useMemo(() => {
    let cash = 0;
    let bank = 0;
    let card = 0;
    let excluded = 0;
    for (const a of accounts as any[]) {
      if (a.type === "cash") cash++;
      else if (a.type === "bank") bank++;
      else if (a.type === "card") card++;
      if (a.includeInTotals === false) excluded++;
    }
    return { cash, bank, card, excluded, total: accounts.length };
  }, [accounts]);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [edit, setEdit] = React.useState<any | null>(null);

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: "",
      type: "cash",
      currency: DEFAULT_CURRENCY,
      initialBalance: 0,
      includeInTotals: true,
    },
  });
  const editForm = useForm<UpdateValues>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      accountId: "",
      name: "",
      type: "cash",
      currency: DEFAULT_CURRENCY,
      balance: 0,
      includeInTotals: true,
    },
  });

  const submitCreate = createForm.handleSubmit(async (values) => {
    if (!user) return;
    try {
      await createAccount(user.uid, values);
      toast.success("Account created");
      setCreateOpen(false);
      createForm.reset();
    } catch (e) {
      toast.error("Failed to create account", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  });

  const submitEdit = editForm.handleSubmit(async (values) => {
    if (!user) return;
    try {
      await updateAccount(user.uid, values);
      toast.success("Account updated");
      setEdit(null);
    } catch (e) {
      toast.error("Failed to update account", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  });

  // Security state
  const [resetLoading, setResetLoading] = React.useState(false);

  const handleResetPassword = async () => {
    if (!user?.email) return;
    setResetLoading(true);
    try {
      await resetPassword(user.email);
      toast.success("Reset email sent", {
        description: `We sent a password reset link to ${user.email}`,
      });
    } catch (err) {
      toast.error("Failed to send reset email", {
        description: err instanceof Error ? err.message : "Please try again later",
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your accounts and application preferences
          </p>
        </div>
      </div>

      <Tabs defaultValue="accounts" className="space-y-6">
        <TabsList>
          <TabsTrigger value="accounts" className="gap-2">
            <Wallet className="h-4 w-4" />
            Accounts
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Lock className="h-4 w-4" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-6">
          <div className="flex justify-end">
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Account
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>New Account</DialogTitle>
                  <DialogDescription>
                    Add a new account to track your finances
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={submitCreate}>
                  <DialogBody className="space-y-5">
                    {/* Account Type Selector */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                        Account Type
                      </Label>
                      <div className="grid grid-cols-3 gap-2">
                        {accountTypes.map((type) => {
                          const Icon = type.icon;
                          const isSelected = createForm.watch("type") === type.value;
                          return (
                            <button
                              key={type.value}
                              type="button"
                              onClick={() =>
                                createForm.setValue("type", type.value, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                })
                              }
                              className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${isSelected
                                ? "border-primary bg-primary/5"
                                : "border-transparent bg-muted/50 hover:bg-muted"
                                }`}
                            >
                              <Icon className={`h-5 w-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                              <span className={`text-xs font-medium ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                                {type.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Account Name */}
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-xs text-muted-foreground uppercase tracking-wider">
                        Account Name
                      </Label>
                      <Input
                        id="name"
                        placeholder="e.g., Main Bank Account"
                        className="h-11"
                        {...createForm.register("name")}
                      />
                    </div>

                    {/* Currency & Initial Balance */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                          Currency
                        </Label>
                        <Select
                          value={createForm.watch("currency")}
                          onValueChange={(v) =>
                            createForm.setValue("currency", v, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COMMON_CURRENCIES.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="initialBalance" className="text-xs text-muted-foreground uppercase tracking-wider">
                          Initial Balance
                        </Label>
                        <Input
                          id="initialBalance"
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          placeholder="0.00"
                          className="h-11"
                          {...createForm.register("initialBalance", {
                            valueAsNumber: true,
                          })}
                        />
                      </div>
                    </div>

                    {/* Include in Totals */}
                    <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary rounded"
                        checked={Boolean(createForm.watch("includeInTotals"))}
                        onChange={(e) =>
                          createForm.setValue("includeInTotals", e.target.checked, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                      />
                      <div>
                        <p className="text-sm font-medium">Include in total balance</p>
                        <p className="text-xs text-muted-foreground">Show this account in your net worth</p>
                      </div>
                    </label>
                  </DialogBody>

                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createForm.formState.isSubmitting} className="min-w-24">
                      {createForm.formState.isSubmitting ? "Creating…" : "Create"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Summary Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-2 border-primary/20">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Balance
                  </CardTitle>
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <PiggyBank className="h-4 w-4 text-primary" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {hasUnsupportedCurrency || missingUsdRate
                    ? "—"
                    : formatMoney(totalBalanceLkr, HOME_CURRENCY)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {accountCounts.total} account{accountCounts.total !== 1 ? "s" : ""}
                  {accountCounts.excluded > 0 && ` · ${accountCounts.excluded} excluded`}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Cash
                  </CardTitle>
                  <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Wallet className="h-4 w-4 text-emerald-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{accountCounts.cash}</div>
                <p className="text-xs text-muted-foreground mt-1">cash account{accountCounts.cash !== 1 ? "s" : ""}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Bank
                  </CardTitle>
                  <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{accountCounts.bank}</div>
                <p className="text-xs text-muted-foreground mt-1">bank account{accountCounts.bank !== 1 ? "s" : ""}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Cards
                  </CardTitle>
                  <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <CreditCard className="h-4 w-4 text-purple-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{accountCounts.card}</div>
                <p className="text-xs text-muted-foreground mt-1">card account{accountCounts.card !== 1 ? "s" : ""}</p>
              </CardContent>
            </Card>
          </div>

          {/* Accounts Table (Desktop) */}
          <Card className="hidden md:block">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Accounts</CardTitle>
                  <CardDescription>
                    View and manage all your financial accounts
                  </CardDescription>
                </div>
                {usdToLkr && (
                  <Badge variant="outline" className="font-mono text-xs">
                    1 USD ≈ {usdToLkr.toFixed(0)} LKR
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="pl-6">Account</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[100px]">Currency</TableHead>
                    <TableHead className="text-right w-[160px]">Balance</TableHead>
                    <TableHead className="w-[60px] pr-6" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                        Loading accounts…
                      </TableCell>
                    </TableRow>
                  ) : accounts.length ? (
                    accounts.map((a: any) => {
                      const isExcluded = a.includeInTotals === false;
                      return (
                        <TableRow key={a.id} className={`group ${isExcluded ? "opacity-60" : ""}`}>
                          <TableCell className="pl-6">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${a.type === "cash"
                                ? "bg-emerald-500/10 text-emerald-600"
                                : a.type === "bank"
                                  ? "bg-blue-500/10 text-blue-600"
                                  : "bg-purple-500/10 text-purple-600"
                                }`}>
                                {getAccountIcon(a.type)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{a.name}</span>
                                  {isExcluded && (
                                    <Badge variant="outline" className="text-[10px] gap-1 px-1.5">
                                      <EyeOff className="h-3 w-3" />
                                      Hidden
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize font-normal">
                              {a.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground font-mono">
                              {formatCurrencyCode(a.currency)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="font-semibold tabular-nums">
                              {(() => {
                                const bal = a.balance ?? 0;
                                const cur = formatCurrencyCode(a.currency);
                                if (cur === HOME_CURRENCY) return formatMoney(bal, HOME_CURRENCY);
                                if (cur === "USD" && typeof usdToLkr === "number")
                                  return formatMoney(bal * usdToLkr, HOME_CURRENCY);
                                return formatMoney(bal, cur);
                              })()}
                            </div>
                            {(() => {
                              const bal = a.balance ?? 0;
                              const cur = formatCurrencyCode(a.currency);
                              if (cur !== HOME_CURRENCY && cur === "USD" && typeof usdToLkr === "number") {
                                return (
                                  <div className="text-xs text-muted-foreground tabular-nums">
                                    {formatMoney(bal, "USD")}
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus:opacity-100"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEdit(a);
                                    editForm.reset({
                                      accountId: a.id,
                                      name: a.name,
                                      type: a.type,
                                      currency: formatCurrencyCode(a.currency),
                                      balance: a.balance ?? 0,
                                      includeInTotals: a.includeInTotals !== false,
                                    });
                                  }}
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={async () => {
                                    if (!user) return;
                                    if (!confirm("Are you sure you want to delete this account?")) return;
                                    try {
                                      await deleteAccount(user.uid, a.id);
                                      toast.success("Account deleted");
                                    } catch (e) {
                                      toast.error("Failed to delete account", {
                                        description: e instanceof Error ? e.message : undefined,
                                      });
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-40 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                            <Wallet className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">No accounts yet</p>
                            <p className="text-sm text-muted-foreground">
                              Create your first account to start tracking
                            </p>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                            <Plus className="h-4 w-4 mr-1" />
                            Add Account
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile Card List */}
          <div className="grid gap-4 md:hidden">
            {loading ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  Loading accounts...
                </CardContent>
              </Card>
            ) : accounts.length ? (
              accounts.map((a: any) => {
                const isExcluded = a.includeInTotals === false;
                return (
                  <Card key={a.id} className={isExcluded ? "opacity-70" : ""}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${a.type === "cash"
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                          : a.type === "bank"
                            ? "bg-blue-500/10 border-blue-500/20 text-blue-600"
                            : "bg-purple-500/10 border-purple-500/20 text-purple-600"
                          }`}
                      >
                        {getAccountIcon(a.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate">{a.name}</h3>
                          {isExcluded && (
                            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <span className="capitalize">{a.type}</span>
                          <span>·</span>
                          <span className="font-mono">{formatCurrencyCode(a.currency)}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-bold tabular-nums text-lg">
                          {(() => {
                            const bal = a.balance ?? 0;
                            const cur = formatCurrencyCode(a.currency);
                            if (cur === HOME_CURRENCY) return formatMoney(bal, HOME_CURRENCY);
                            if (cur === "USD" && typeof usdToLkr === "number")
                              return formatMoney(bal * usdToLkr, HOME_CURRENCY);
                            return formatMoney(bal, cur);
                          })()}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="-mr-2 h-8 w-8 text-muted-foreground">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEdit(a);
                                editForm.reset({
                                  accountId: a.id,
                                  name: a.name,
                                  type: a.type,
                                  currency: formatCurrencyCode(a.currency),
                                  balance: a.balance ?? 0,
                                  includeInTotals: a.includeInTotals !== false,
                                });
                              }}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={async () => {
                                if (!user) return;
                                if (!confirm("Are you sure you want to delete this account?")) return;
                                try {
                                  await deleteAccount(user.uid, a.id);
                                  toast.success("Account deleted");
                                } catch (e) {
                                  toast.error("Failed to delete account", {
                                    description: e instanceof Error ? e.message : undefined,
                                  });
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card>
                <CardContent className="py-10 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      <Wallet className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">No accounts yet</p>
                      <p className="text-sm text-muted-foreground">
                        Create your first account to start tracking
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Account
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="security" className="max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Manage your profile security and password
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium">Email Address</h3>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>

                <div className="pt-4 border-t">
                  <h3 className="text-sm font-medium mb-3">Password</h3>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Update your password securely via email
                    </div>
                    <Button onClick={handleResetPassword} disabled={resetLoading}>
                      {resetLoading ? "Sending..." : "Reset Password"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={Boolean(edit)} onOpenChange={(v) => (!v ? setEdit(null) : v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>
              Update your account details
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEdit}>
            <DialogBody className="space-y-5">
              {/* Account Type */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Account Type
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {accountTypes.map((type) => {
                    const Icon = type.icon;
                    const isSelected = editForm.watch("type") === type.value;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() =>
                          editForm.setValue("type", type.value, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${isSelected
                          ? "border-primary bg-primary/5"
                          : "border-transparent bg-muted/50 hover:bg-muted"
                          }`}
                      >
                        <Icon className={`h-5 w-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`text-xs font-medium ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                          {type.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Account Name */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Account Name
                </Label>
                <Input
                  className="h-11"
                  {...editForm.register("name")}
                />
              </div>

              {/* Currency & Balance */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Currency
                  </Label>
                  <Select
                    value={editForm.watch("currency")}
                    onValueChange={(v) =>
                      editForm.setValue("currency", v, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Balance
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    className="h-11"
                    {...editForm.register("balance", {
                      valueAsNumber: true,
                    })}
                  />
                </div>
              </div>

              {/* Include in Totals */}
              <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary rounded"
                  checked={Boolean(editForm.watch("includeInTotals"))}
                  onChange={(e) =>
                    editForm.setValue("includeInTotals", e.target.checked, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
                <div>
                  <p className="text-sm font-medium">Include in total balance</p>
                  <p className="text-xs text-muted-foreground">Show this account in your net worth</p>
                </div>
              </label>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEdit(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editForm.formState.isSubmitting} className="min-w-24">
                {editForm.formState.isSubmitting ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
