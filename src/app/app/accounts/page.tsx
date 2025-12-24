"use client";

import * as React from "react";
import Link from "next/link";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/auth-provider";
import { useAccounts } from "@/lib/finance/hooks";
import { createAccount } from "@/lib/finance/mutations";
import { updateAccount, deleteAccount } from "@/lib/finance/account-mutations";
import { formatCurrencyCode, formatMoney } from "@/lib/format";
import { COMMON_CURRENCIES, DEFAULT_CURRENCY } from "@/shared/currency";
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

const createSchema = z.object({
  name: z.string().min(1).max(64),
  type: z.enum(["cash", "bank", "card"]),
  currency: z.string().min(3).max(3),
  initialBalance: z.number().finite(),
});

type CreateValues = z.infer<typeof createSchema>;

const updateSchema = z.object({
  accountId: z.string().min(1),
  name: z.string().min(1).max(64),
  type: z.enum(["cash", "bank", "card"]),
  currency: z.string().min(3).max(3),
});
type UpdateValues = z.infer<typeof updateSchema>;

export default function AccountsPage() {
  const { user } = useAuth();
  const { accounts, loading } = useAccounts();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [edit, setEdit] = React.useState<any | null>(null);

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: "",
      type: "cash",
      currency: DEFAULT_CURRENCY,
      initialBalance: 0,
    },
  });
  const editForm = useForm<UpdateValues>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      accountId: "",
      name: "",
      type: "cash",
      currency: DEFAULT_CURRENCY,
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
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Cash, bank, and card accounts with atomic balance updates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/app/accounts/new">New account</Link>
          </Button>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>Add account</Button>
            </DialogTrigger>
            <DialogContent>
            <DialogHeader>
              <DialogTitle>New account</DialogTitle>
            </DialogHeader>
            <form className="grid gap-4" onSubmit={submitCreate}>
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...createForm.register("name")} />
              </div>
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select
                  value={createForm.watch("type")}
                  onValueChange={(v) =>
                    createForm.setValue("type", v as any, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Currency</Label>
                <Select
                  value={createForm.watch("currency")}
                  onValueChange={(v) =>
                    createForm.setValue("currency", v, {
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
              <div className="grid gap-2">
                <Label htmlFor="initialBalance">Initial balance</Label>
                <Input
                  id="initialBalance"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  {...createForm.register("initialBalance", {
                    valueAsNumber: true,
                  })}
                />
              </div>
              <Button
                type="submit"
                disabled={createForm.formState.isSubmitting}
              >
                {createForm.formState.isSubmitting ? "Creating…" : "Create"}
              </Button>
            </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your accounts</CardTitle>
          <CardDescription>
            Balances are computed and enforced by Firestore rules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="w-[160px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : accounts.length ? (
                accounts.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="capitalize">{a.type}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatCurrencyCode(a.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(a.balance ?? 0, formatCurrencyCode(a.currency))}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEdit(a);
                            editForm.reset({
                              accountId: a.id,
                              name: a.name,
                              type: a.type,
                              currency: formatCurrencyCode(a.currency),
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
                              await deleteAccount(user.uid, a.id);
                              toast.success("Account deleted");
                            } catch (e) {
                              toast.error("Failed to delete account", {
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
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No accounts yet. Create one to start tracking.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={Boolean(edit)} onOpenChange={(v) => (!v ? setEdit(null) : v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit account</DialogTitle>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={submitEdit}>
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input {...editForm.register("name")} />
            </div>
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select
                value={editForm.watch("type")}
                onValueChange={(v) =>
                  editForm.setValue("type", v as any, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Currency</Label>
              <Select
                value={editForm.watch("currency")}
                onValueChange={(v) =>
                  editForm.setValue("currency", v, {
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
            <Button type="submit" disabled={editForm.formState.isSubmitting}>
              {editForm.formState.isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}


