"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/auth-provider";
import { createAccount } from "@/lib/finance/mutations";
import { COMMON_CURRENCIES, DEFAULT_CURRENCY } from "@/shared/currency";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  name: z.string().min(1).max(64),
  type: z.enum(["cash", "bank", "card"]),
  currency: z.string().min(3).max(3),
  initialBalance: z.number().finite(),
  includeInTotals: z.boolean(),
});

type Values = z.infer<typeof schema>;

export default function NewAccountPage() {
  const router = useRouter();
  const { user } = useAuth();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      type: "cash",
      currency: DEFAULT_CURRENCY,
      initialBalance: 0,
      includeInTotals: true,
    },
  });

  const submit = form.handleSubmit(async (values) => {
    if (!user) return;
    try {
      await createAccount(user.uid, values);
      toast.success("Account created");
      router.replace("/app/accounts");
    } catch (e) {
      toast.error("Failed to create account", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  });

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">New account</h1>
        <Link className="text-sm underline" href="/app/accounts">
          Back
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create account</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:max-w-lg" onSubmit={submit}>
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input {...form.register("name")} />
              {form.formState.errors.name ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select
                  value={form.watch("type")}
                  onValueChange={(v) =>
                    form.setValue("type", v as any, {
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
              <Label>Initial balance</Label>
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                {...form.register("initialBalance", { valueAsNumber: true })}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="includeInTotals"
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={Boolean(form.watch("includeInTotals"))}
                onChange={(e) =>
                  form.setValue("includeInTotals", e.target.checked, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
              <Label htmlFor="includeInTotals">Include in total balance</Label>
            </div>

            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Creating…" : "Create"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}




