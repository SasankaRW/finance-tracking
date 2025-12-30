"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/auth-provider";
import { createCategory } from "@/lib/finance/category-mutations";
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
  kind: z.enum(["expense", "income"]),
  name: z.string().min(1).max(48),
});

type Values = z.infer<typeof schema>;

export default function NewCategoryPage() {
  const router = useRouter();
  const { user } = useAuth();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { kind: "expense", name: "" },
  });

  const submit = form.handleSubmit(async (values) => {
    if (!user) return;
    try {
      await createCategory(user.uid, values);
      toast.success("Category created");
      router.replace("/app/categories");
    } catch (e) {
      toast.error("Failed to create category", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  });

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">New category</h1>
        <Link className="text-sm underline" href="/app/categories">
          Back
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create category</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:max-w-lg" onSubmit={submit}>
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select
                value={form.watch("kind")}
                onValueChange={(v) =>
                  form.setValue("kind", v as any, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Name</Label>
              <Input {...form.register("name")} />
              {form.formState.errors.name ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              ) : null}
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













