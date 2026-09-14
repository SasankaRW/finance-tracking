"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Wallet,
  Building2,
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  PiggyBank,
  EyeOff,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-provider";
import { useConfirm } from "@/components/confirm-dialog";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { useAccounts } from "@/lib/finance/hooks";
import { useScreenSecurity } from "@/lib/screen-security";
import { createAccount } from "@/lib/finance/mutations";
import { updateAccount, deleteAccount } from "@/lib/finance/account-mutations";
import { formatCurrencyCode, formatMoney } from "@/lib/format";
import { COMMON_CURRENCIES, DEFAULT_CURRENCY, HOME_CURRENCY } from "@/shared/currency";
import { useFxRates } from "@/lib/fx/use-fx-rates";
import { SettingsStatTile } from "@/app/app/settings/settings-stat-tile";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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
  { value: "cash", label: "Cash", icon: Wallet, description: "Physical currency", pill: "bg-emerald-200/90 text-emerald-900" },
  { value: "bank", label: "Bank", icon: Building2, description: "Bank account", pill: "bg-blue-200/90 text-blue-900" },
  { value: "card", label: "Card", icon: CreditCard, description: "Credit/Debit", pill: "bg-purple-200/90 text-purple-900" },
] as const;

function AccountTypeSelector({ form }: { form: any }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground uppercase tracking-wider">
        Account Type
      </Label>
      <div className="flex flex-wrap gap-2">
        {accountTypes.map((type) => {
          const Icon = type.icon;
          const isSelected = form.watch("type") === type.value;
          return (
            <button
              key={type.value}
              type="button"
              onClick={() =>
                form.setValue("type", type.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              className={`motion-expressive press-expressive inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-all ${
                isSelected ? type.pill : "bg-muted text-muted-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {type.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function IncludeInTotalsToggle({ form }: { form: any }) {
  const checked = Boolean(form.watch("includeInTotals"));
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border p-3">
      <div>
        <p className="text-sm font-medium">Include in total balance</p>
        <p className="text-xs text-muted-foreground">Show this account in your net worth</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label="Include in total balance"
        onClick={() =>
          form.setValue("includeInTotals", !checked, {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

// Converts an account's balance to a display string, plus an optional secondary line
// (e.g. the original USD amount) when the primary value is a converted estimate.
function accountDisplayBalance(balance: number, currency: string, usdToLkr: number | null) {
  const cur = formatCurrencyCode(currency);
  if (cur === HOME_CURRENCY) {
    return { primary: formatMoney(balance, HOME_CURRENCY), secondary: null as string | null };
  }
  if (cur === "USD" && typeof usdToLkr === "number") {
    return { primary: formatMoney(balance * usdToLkr, HOME_CURRENCY), secondary: formatMoney(balance, "USD") };
  }
  return { primary: formatMoney(balance, cur), secondary: null as string | null };
}

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

export function AccountsPanel() {
  // Account balances are the most sensitive numbers in the app — block
  // screenshots/recording and blank the recents thumbnail only while this
  // panel is actually on screen.
  useScreenSecurity(true);

  const { user } = useAuth();
  const confirm = useConfirm();
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

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
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
                <AccountTypeSelector form={createForm} />

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

                <IncludeInTotalsToggle form={createForm} />
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
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <SettingsStatTile
          label="Total Balance"
          highlighted
          icon={PiggyBank}
          iconWrapClassName="bg-primary/10"
          iconClassName="text-primary"
          value={
            hasUnsupportedCurrency || missingUsdRate
              ? "—"
              : formatMoney(totalBalanceLkr, HOME_CURRENCY)
          }
          sub={`${accountCounts.total} account${accountCounts.total !== 1 ? "s" : ""}${accountCounts.excluded > 0 ? ` · ${accountCounts.excluded} excluded` : ""}`}
        />
        <SettingsStatTile
          label="Cash"
          icon={Wallet}
          iconWrapClassName="bg-emerald-500/10"
          iconClassName="text-emerald-600"
          value={accountCounts.cash}
          sub={`cash account${accountCounts.cash !== 1 ? "s" : ""}`}
        />
        <SettingsStatTile
          label="Bank"
          icon={Building2}
          iconWrapClassName="bg-blue-500/10"
          iconClassName="text-blue-600"
          value={accountCounts.bank}
          sub={`bank account${accountCounts.bank !== 1 ? "s" : ""}`}
        />
        <SettingsStatTile
          label="Cards"
          icon={CreditCard}
          iconWrapClassName="bg-purple-500/10"
          iconClassName="text-purple-600"
          value={accountCounts.card}
          sub={`card account${accountCounts.card !== 1 ? "s" : ""}`}
        />
      </div>

      {/* Accounts Table */}
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
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5} className="py-4">
                      <Skeleton className="h-8 w-full rounded-xl" />
                    </TableCell>
                  </TableRow>
                ))
              ) : accounts.length ? (
                accounts.map((a: any) => {
                  const isExcluded = a.includeInTotals === false;
                  const display = accountDisplayBalance(a.balance ?? 0, a.currency, usdToLkr);
                  return (
                    <TableRow key={a.id} className={`group ${isExcluded ? "opacity-60" : ""}`}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${a.type === "cash"
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
                        <div className="font-semibold tabular-nums">{display.primary}</div>
                        {display.secondary && (
                          <div className="text-xs text-muted-foreground tabular-nums">{display.secondary}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <RowActionsMenu
                          ariaLabel={`${a.name} actions`}
                          triggerClassName="h-8 w-8 p-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus:opacity-100"
                          actions={[
                            {
                              label: "Edit",
                              icon: Pencil,
                              onClick: () => {
                                setEdit(a);
                                editForm.reset({
                                  accountId: a.id,
                                  name: a.name,
                                  type: a.type,
                                  currency: formatCurrencyCode(a.currency),
                                  balance: a.balance ?? 0,
                                  includeInTotals: a.includeInTotals !== false,
                                });
                              },
                            },
                            {
                              label: "Delete",
                              icon: Trash2,
                              destructive: true,
                              onClick: async () => {
                                if (!user) return;
                                if (!(await confirm({ title: "Delete this account?", description: "This can't be undone.", destructive: true }))) return;
                                try {
                                  await deleteAccount(user.uid, a.id);
                                  toast.success("Account deleted");
                                } catch (e) {
                                  toast.error("Failed to delete account", {
                                    description: e instanceof Error ? e.message : undefined,
                                  });
                                }
                              },
                            },
                          ]}
                        />
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
          <>
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-14 w-full rounded-xl" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : accounts.length ? (
          accounts.map((a: any) => {
            const isExcluded = a.includeInTotals === false;
            return (
              <Card key={a.id} className={isExcluded ? "opacity-70" : ""}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border ${a.type === "cash"
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
                      {accountDisplayBalance(a.balance ?? 0, a.currency, usdToLkr).primary}
                    </div>
                    <RowActionsMenu
                      ariaLabel={`${a.name} actions`}
                      triggerClassName="-mr-3 text-muted-foreground"
                      actions={[
                        {
                          label: "Edit",
                          icon: Pencil,
                          onClick: () => {
                            setEdit(a);
                            editForm.reset({
                              accountId: a.id,
                              name: a.name,
                              type: a.type,
                              currency: formatCurrencyCode(a.currency),
                              balance: a.balance ?? 0,
                              includeInTotals: a.includeInTotals !== false,
                            });
                          },
                        },
                        {
                          label: "Delete",
                          icon: Trash2,
                          destructive: true,
                          onClick: async () => {
                            if (!user) return;
                            if (!(await confirm({ title: "Delete this account?", description: "This can't be undone.", destructive: true }))) return;
                            try {
                              await deleteAccount(user.uid, a.id);
                              toast.success("Account deleted");
                            } catch (e) {
                              toast.error("Failed to delete account", {
                                description: e instanceof Error ? e.message : undefined,
                              });
                            }
                          },
                        },
                      ]}
                    />
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
              <AccountTypeSelector form={editForm} />

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
                  <Label htmlFor="balance" className="text-xs text-muted-foreground uppercase tracking-wider">
                    Balance
                  </Label>
                  <Input
                    id="balance"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="h-11"
                    {...editForm.register("balance", {
                      valueAsNumber: true,
                    })}
                  />
                </div>
              </div>

              <IncludeInTotalsToggle form={editForm} />
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEdit(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editForm.formState.isSubmitting} className="min-w-24">
                {editForm.formState.isSubmitting ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
