"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { toast } from "sonner";
import { CalendarIcon } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/auth/auth-provider";
import { useAccounts, useCategories, useTransactions } from "@/lib/finance/hooks";
import {
  createIncomeOrExpense,
  createTransfer,
  deleteTransaction,
  editTransaction,
} from "@/lib/finance/mutations";
import { formatMoney } from "@/lib/format";
import { downloadTextFile, toCsv } from "@/lib/export/csv";
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
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const kindSchema = z.enum(["expense", "income", "transfer"]);

const createSchema = z
  .object({
    kind: kindSchema,
    amount: z.number().positive().finite(),
    accountId: z.string().optional(),
    categoryId: z.string().optional(),
    fromAccountId: z.string().optional(),
    toAccountId: z.string().optional(),
    occurredAt: z.date(),
    note: z.string().max(280).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "transfer") {
      if (!v.fromAccountId) ctx.addIssue({ code: "custom", path: ["fromAccountId"], message: "Required" });
      if (!v.toAccountId) ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Required" });
      if (v.fromAccountId && v.toAccountId && v.fromAccountId === v.toAccountId) {
        ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Must be different" });
      }
    } else {
      if (!v.accountId) ctx.addIssue({ code: "custom", path: ["accountId"], message: "Required" });
      if (!v.categoryId) ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Required" });
    }
  });

type CreateValues = z.infer<typeof createSchema>;

export default function TransactionsPage() {
  const { user } = useAuth();
  const { accounts } = useAccounts();
  const { categories: expenseCats } = useCategories("expense");
  const { categories: incomeCats } = useCategories("income");

  const [filters, setFilters] = React.useState<{
    accountId?: string;
    categoryId?: string;
  }>({});
  const { transactions, loading } = useTransactions(filters);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [edit, setEdit] = React.useState<any | null>(null);

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      kind: "expense",
      amount: 1,
      occurredAt: new Date(),
      note: "",
    },
  });

  const kind = form.watch("kind");
  const categories = kind === "income" ? incomeCats : expenseCats;

  const submitCreate = form.handleSubmit(async (values) => {
    if (!user) return;
    try {
      if (values.kind === "transfer") {
        await createTransfer(user.uid, {
          amount: values.amount,
          fromAccountId: values.fromAccountId!,
          toAccountId: values.toAccountId!,
          occurredAt: values.occurredAt,
          note: values.note?.trim() || undefined,
        });
      } else {
        await createIncomeOrExpense(user.uid, {
          kind: values.kind,
          amount: values.amount,
          accountId: values.accountId!,
          categoryId: values.categoryId!,
          occurredAt: values.occurredAt,
          note: values.note?.trim() || undefined,
        });
      }
      toast.success("Transaction saved");
      setCreateOpen(false);
      form.reset({ kind: values.kind, amount: 0, occurredAt: new Date(), note: "" });
    } catch (e) {
      toast.error("Failed to save transaction", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  });

  async function submitEdit(values: CreateValues) {
    if (!user || !edit) return;
    try {
      await editTransaction(user.uid, {
        transactionId: edit.id,
        expectedUpdatedAt: edit.updatedAt,
        amount: values.amount,
        occurredAt: values.occurredAt,
        note: values.note?.trim() ? values.note.trim() : null,
        categoryId: values.kind === "income" || values.kind === "expense" ? values.categoryId : undefined,
      });
      toast.success("Transaction updated");
      setEdit(null);
    } catch (e) {
      toast.error("Failed to update transaction", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            Add, edit, and delete transactions. Balances update atomically.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const accountById = new Map(
                accounts.map((a: any) => [a.id, a.name]),
              );
              const categoryById = new Map(
                [...expenseCats, ...incomeCats].map((c: any) => [c.id, c.name]),
              );

              const rows = (transactions as any[]).map((t) => {
                const occurredAt =
                  t.occurredAt instanceof Timestamp
                    ? t.occurredAt.toDate().toISOString()
                    : "";
                return {
                  id: t.id,
                  kind: t.kind,
                  status: t.status,
                  occurredAt,
                  amount: t.amount,
                  currency: t.currency ?? "",
                  account: t.accountId ? accountById.get(t.accountId) ?? "" : "",
                  category: t.categoryId
                    ? categoryById.get(t.categoryId) ?? ""
                    : "",
                  fromAccount: t.fromAccountId
                    ? accountById.get(t.fromAccountId) ?? ""
                    : "",
                  toAccount: t.toAccountId
                    ? accountById.get(t.toAccountId) ?? ""
                    : "",
                  note: t.note ?? "",
                };
              });

              const csv = toCsv(rows);
              downloadTextFile(`cashly-transactions-${new Date().toISOString().slice(0,10)}.csv`, csv);
              toast.success("CSV exported");
            }}
            disabled={loading || !(transactions as any[]).length}
          >
            Export CSV
          </Button>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>Add transaction</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New transaction</DialogTitle>
            </DialogHeader>
            <form className="grid gap-4" onSubmit={submitCreate}>
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select
                  value={form.watch("kind")}
                  onValueChange={(v) => {
                    form.setValue("kind", v as any, { shouldDirty: true, shouldValidate: true });
                    form.setValue("categoryId", undefined);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    {...form.register("amount", { valueAsNumber: true })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(form.watch("occurredAt"), "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={form.watch("occurredAt")}
                        onSelect={(d) => d && form.setValue("occurredAt", d, { shouldDirty: true })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {kind === "transfer" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>From</Label>
                    <Select
                      value={form.watch("fromAccountId") ?? ""}
                      onValueChange={(v) => form.setValue("fromAccountId", v, { shouldDirty: true, shouldValidate: true })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a: any) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>To</Label>
                    <Select
                      value={form.watch("toAccountId") ?? ""}
                      onValueChange={(v) => form.setValue("toAccountId", v, { shouldDirty: true, shouldValidate: true })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a: any) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Account</Label>
                    <Select
                      value={form.watch("accountId") ?? ""}
                      onValueChange={(v) => form.setValue("accountId", v, { shouldDirty: true, shouldValidate: true })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a: any) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Category</Label>
                    <Select
                      value={form.watch("categoryId") ?? ""}
                      onValueChange={(v) => form.setValue("categoryId", v, { shouldDirty: true, shouldValidate: true })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="note">Note (optional)</Label>
                <Input id="note" {...form.register("note")} />
              </div>

              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : "Save"}
              </Button>
            </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>Filter by account or category.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 sm:max-w-lg">
            <div className="grid gap-2">
              <Label>Account</Label>
              <Select
                value={filters.accountId ?? "all"}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, accountId: v === "all" ? undefined : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {accounts.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Category</Label>
              <Select
                value={filters.categoryId ?? "all"}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, categoryId: v === "all" ? undefined : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {[...expenseCats, ...incomeCats].map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[190px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : transactions.length ? (
                (transactions as any[]).map((t) => {
                  const occurredAt =
                    t.occurredAt instanceof Timestamp
                      ? t.occurredAt.toDate()
                      : new Date();
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(occurredAt, "PP")}
                      </TableCell>
                      <TableCell className="capitalize">{t.kind}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.note ? t.note : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {t.kind === "expense" ? "-" : ""}
                        {formatMoney(t.amount ?? 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEdit(t);
                              form.reset({
                                kind: t.kind,
                                amount: t.amount ?? 0,
                                occurredAt,
                                note: t.note ?? "",
                                accountId: t.accountId,
                                categoryId: t.categoryId,
                                fromAccountId: t.fromAccountId,
                                toAccountId: t.toAccountId,
                              });
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={async () => {
                              if (!user) return;
                              try {
                                await deleteTransaction(user.uid, t.id, t.updatedAt);
                                toast.success("Deleted");
                              } catch (e) {
                                toast.error("Failed to delete", {
                                  description:
                                    e instanceof Error ? e.message : undefined,
                                });
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No transactions yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={Boolean(edit)} onOpenChange={(v) => (!v ? setEdit(null) : v)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit transaction</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={form.handleSubmit((v) => submitEdit(v))}
          >
            <div className="grid gap-2">
              <Label>Amount</Label>
              <Input inputMode="decimal" {...form.register("amount")} />
            </div>
            {form.watch("kind") !== "transfer" ? (
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select
                  value={form.watch("categoryId") ?? ""}
                  onValueChange={(v) =>
                    form.setValue("categoryId", v, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label>Note</Label>
              <Input {...form.register("note")} />
            </div>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}


