"use client";

import * as React from "react";
import Link from "next/link";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/auth-provider";
import { useCategories } from "@/lib/finance/hooks";
import {
  createCategory,
  deleteCategory,
  renameCategory,
} from "@/lib/finance/category-mutations";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const createSchema = z.object({
  kind: z.enum(["income", "expense"]),
  name: z.string().min(1).max(48),
});
type CreateValues = z.infer<typeof createSchema>;

const renameSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1).max(48),
});
type RenameValues = z.infer<typeof renameSchema>;

function CategoryTable({
  kind,
}: {
  kind: "income" | "expense";
}) {
  const { user } = useAuth();
  const { categories, loading } = useCategories(kind);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [edit, setEdit] = React.useState<any | null>(null);

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { kind, name: "" },
  });
  const editForm = useForm<RenameValues>({
    resolver: zodResolver(renameSchema),
    defaultValues: { categoryId: "", name: "" },
  });

  const submitCreate = createForm.handleSubmit(async (values) => {
    if (!user) return;
    try {
      await createCategory(user.uid, values);
      toast.success("Category created");
      setCreateOpen(false);
      createForm.reset({ kind, name: "" });
    } catch (e) {
      toast.error("Failed to create category", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  });

  const submitEdit = editForm.handleSubmit(async (values) => {
    if (!user) return;
    try {
      await renameCategory(user.uid, values);
      toast.success("Category updated");
      setEdit(null);
    } catch (e) {
      toast.error("Failed to update category", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  });

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {kind === "income"
            ? "Income categories"
            : "Expense categories"}
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Add</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                New {kind === "income" ? "income" : "expense"} category
              </DialogTitle>
            </DialogHeader>
            <form className="grid gap-4" onSubmit={submitCreate}>
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input {...createForm.register("name")} />
              </div>
              <Button type="submit" disabled={createForm.formState.isSubmitting}>
                {createForm.formState.isSubmitting ? "Creating…" : "Create"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="capitalize">{kind} categories</CardTitle>
          <CardDescription>Used for transaction classification.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-[160px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : categories.length ? (
                categories.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEdit(c);
                            editForm.reset({ categoryId: c.id, name: c.name });
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
                              await deleteCategory(user.uid, c.id);
                              toast.success("Category deleted");
                            } catch (e) {
                              toast.error("Failed to delete category", {
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
                  <TableCell colSpan={2} className="text-muted-foreground">
                    No categories.
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
            <DialogTitle>Edit category</DialogTitle>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={submitEdit}>
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input {...editForm.register("name")} />
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

export default function CategoriesPage() {
  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Categories</h1>
          <p className="text-sm text-muted-foreground">
            Manage income and expense categories (defaults are seeded on first
            login).
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/app/categories/new">New category</Link>
        </Button>
      </div>

      <Tabs defaultValue="expense">
        <TabsList>
          <TabsTrigger value="expense">Expense</TabsTrigger>
          <TabsTrigger value="income">Income</TabsTrigger>
        </TabsList>
        <TabsContent value="expense">
          <CategoryTable kind="expense" />
        </TabsContent>
        <TabsContent value="income">
          <CategoryTable kind="income" />
        </TabsContent>
      </Tabs>
    </div>
  );
}


