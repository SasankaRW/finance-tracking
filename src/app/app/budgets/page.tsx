"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/auth-provider";
import { useBudgets, useCategories } from "@/lib/finance/hooks";
import { createBudget, deleteBudget } from "@/lib/finance/budget-mutations";
import { COMMON_CURRENCIES, DEFAULT_CURRENCY } from "@/shared/currency";
import { formatMoney } from "@/lib/format";
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

function currentMonth() {
  return format(new Date(), "yyyy-MM");
}

const createSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  categoryId: z.string().optional(),
  limitAmount: z.number().positive().finite(),
  currency: z.string().min(3).max(3),
});
type CreateValues = z.infer<typeof createSchema>;

export default function BudgetsPage() {
  const { user } = useAuth();
  const [month, setMonth] = React.useState(currentMonth());
  const { budgets, loading } = useBudgets(month);
  const { categories: expenseCategories } = useCategories("expense");

  const [open, setOpen] = React.useState(false);
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      month,
      categoryId: "overall",
      limitAmount: 500,
      currency: DEFAULT_CURRENCY,
    },
  });

  React.useEffect(() => {
    form.setValue("month", month);
  }, [month, form]);

  const submit = form.handleSubmit(async (values) => {
    if (!user) return;
    try {
      await createBudget(user.uid, {
        month: values.month,
        categoryId:
          values.categoryId && values.categoryId !== "overall"
            ? values.categoryId
            : undefined,
        limitAmount: values.limitAmount,
        currency: values.currency,
      });
      toast.success("Budget created");
      setOpen(false);
    } catch (e) {
      toast.error("Failed to create budget", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  });

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Budgets</h1>
          <p className="text-sm text-muted-foreground">
            Monthly spending limits (overall or per category).
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Add budget</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New budget</DialogTitle>
            </DialogHeader>
            <form className="grid gap-4" onSubmit={submit}>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Month</Label>
                  <Input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Currency</Label>
                  <Select
                    value={form.watch("currency")}
                    onValueChange={(v) =>
                      form.setValue("currency", v, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger>
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
              </div>

              <div className="grid gap-2">
                <Label>Category</Label>
                <Select
                  value={form.watch("categoryId") ?? "overall"}
                  onValueChange={(v) =>
                    form.setValue("categoryId", v, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overall">Overall (all expenses)</SelectItem>
                    {expenseCategories.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Limit</Label>
                <Input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  {...form.register("limitAmount", { valueAsNumber: true })}
                />
              </div>

              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Creating…" : "Create"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Budgets for {month}</CardTitle>
          <CardDescription>
            Alerts are shown on the dashboard when limits are exceeded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scope</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="text-right">Limit</TableHead>
                <TableHead className="w-[140px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : budgets.length ? (
                (budgets as any[]).map((b) => {
                  const scope = b.categoryId
                    ? expenseCategories.find((c: any) => c.id === b.categoryId)
                        ?.name ?? "Category"
                    : "Overall";
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{scope}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {b.currency}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(b.limitAmount, b.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={async () => {
                            if (!user) return;
                            try {
                              await deleteBudget(user.uid, b.id);
                              toast.success("Budget deleted");
                            } catch (e) {
                              toast.error("Failed to delete budget", {
                                description:
                                  e instanceof Error ? e.message : undefined,
                              });
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No budgets for this month.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}


