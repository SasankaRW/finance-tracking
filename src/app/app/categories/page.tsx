"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Plus,
  Tag,
  TrendingUp,
  TrendingDown,
  Pencil,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-provider";
import { useConfirm } from "@/components/confirm-dialog";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { useCategories } from "@/lib/finance/hooks";
import {
  createCategory,
  deleteCategory,
  renameCategory,
} from "@/lib/finance/category-mutations";
import { CategoryIconPicker, getCategoryIcon, getCategoryIconKey } from "@/lib/finance/category-icons";
import { SettingsStatTile } from "@/app/app/settings/settings-stat-tile";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const createSchema = z.object({
  kind: z.enum(["income", "expense"]),
  name: z.string().min(1).max(48),
  icon: z.string().max(32).optional(),
});
type CreateValues = z.infer<typeof createSchema>;

const renameSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1).max(48),
  icon: z.string().max(32).optional(),
});
type RenameValues = z.infer<typeof renameSchema>;

// A compact icon-preview button that pops the picker grid open, so the form
// stays a single tidy field instead of an always-open grid crowding the dialog.
function IconPickerField({
  value,
  fallback,
  onChange,
}: {
  value?: string;
  fallback: { name?: string; kind?: string };
  onChange: (key: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const Icon = getCategoryIcon({ ...fallback, icon: value });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="motion-expressive press-expressive flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground"
          aria-label="Choose icon"
        >
          <Icon className="h-5 w-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <CategoryIconPicker
          value={value ?? getCategoryIconKey(fallback)}
          onChange={(key) => {
            onChange(key);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function CategoryTable({ kind }: { kind: "income" | "expense" }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const { categories, loading, error } = useCategories(kind);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [edit, setEdit] = React.useState<any | null>(null);

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { kind, name: "", icon: "" },
  });
  const editForm = useForm<RenameValues>({
    resolver: zodResolver(renameSchema),
    defaultValues: { categoryId: "", name: "", icon: "" },
  });

  const submitCreate = createForm.handleSubmit(async (values) => {
    if (!user) return;
    try {
      await createCategory(user.uid, values);
      toast.success("Category created");
      setCreateOpen(false);
      createForm.reset({ kind, name: "", icon: "" });
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

  const isIncome = kind === "income";

  return (
    <div className="space-y-4">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${
            isIncome ? "bg-emerald-500/10" : "bg-rose-500/10"
          }`}>
            {isIncome ? (
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            ) : (
              <TrendingDown className="h-5 w-5 text-rose-600" />
            )}
          </div>
          <div>
            <h3 className="font-semibold">
              {isIncome ? "Income" : "Expense"} Categories
            </h3>
            <p className="text-sm text-muted-foreground">
              {categories.length} categor{categories.length !== 1 ? "ies" : "y"}
            </p>
          </div>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>New {isIncome ? "Income" : "Expense"} Category</DialogTitle>
              <DialogDescription>
                Create a new category to organize your transactions
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitCreate}>
              <DialogBody className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Category Name
                  </Label>
                  <div className="flex gap-2">
                    <IconPickerField
                      value={createForm.watch("icon")}
                      fallback={{ name: createForm.watch("name"), kind }}
                      onChange={(key) => createForm.setValue("icon", key)}
                    />
                    <Input
                      placeholder={isIncome ? "e.g., Salary, Freelance" : "e.g., Food, Transport"}
                      className="h-11 flex-1"
                      {...createForm.register("name")}
                      autoFocus
                    />
                  </div>
                </div>
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createForm.formState.isSubmitting} className="min-w-20">
                  {createForm.formState.isSubmitting ? "Creating…" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Categories — a tile grid rather than a table: one markup at every
          width, tap a tile to edit (a bigger target than the ⋯ menu), and the
          menu stays for delete. */}
      {loading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[4.25rem] animate-pulse rounded-2xl bg-muted/60" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          Failed to load categories{error?.message ? `: ${error.message}` : ""}
        </div>
      ) : categories.length ? (
        <div className="animate-ios-in grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {categories.map((c: any) => {
            const RowIcon = getCategoryIcon(c);
            const openEdit = () => {
              setEdit(c);
              editForm.reset({ categoryId: c.id, name: c.name, icon: c.icon ?? "" });
            };
            return (
              <div
                key={c.id}
                className="elevation-1 flex min-w-0 items-center gap-2 rounded-2xl bg-card py-2 pl-2 pr-1"
              >
                <button
                  type="button"
                  onClick={openEdit}
                  aria-label={`Edit ${c.name}`}
                  className="motion-expressive press-expressive flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1 text-left"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      isIncome ? "bg-emerald-500/10" : "bg-rose-500/10"
                    }`}
                  >
                    <RowIcon className={`h-4 w-4 ${isIncome ? "text-emerald-600" : "text-rose-600"}`} />
                  </span>
                  <span className="truncate text-sm font-semibold">{c.name}</span>
                </button>
                <RowActionsMenu
                  ariaLabel={`${c.name} actions`}
                  triggerClassName="h-9 w-9 shrink-0 rounded-full p-0 text-muted-foreground"
                  actions={[
                    { label: "Edit", icon: Pencil, onClick: openEdit },
                    {
                      label: "Delete",
                      icon: Trash2,
                      destructive: true,
                      onClick: async () => {
                        if (!user) return;
                        if (!(await confirm({ title: "Delete this category?", destructive: true }))) return;
                        try {
                          await deleteCategory(user.uid, c.id);
                          toast.success("Category deleted");
                        } catch (e) {
                          toast.error("Failed to delete category", {
                            description: e instanceof Error ? e.message : undefined,
                          });
                        }
                      },
                    },
                  ]}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed p-8 text-center">
          <div className="flex flex-col items-center gap-2">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                isIncome ? "bg-emerald-500/10" : "bg-rose-500/10"
              }`}
            >
              <Tag className={`h-5 w-5 ${isIncome ? "text-emerald-600" : "text-rose-600"}`} />
            </div>
            <p className="font-medium">No categories yet</p>
            <p className="text-sm text-muted-foreground">Add a category to organize your {kind}</p>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Add Category
            </Button>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={Boolean(edit)} onOpenChange={(v) => (!v ? setEdit(null) : v)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Update the category name or icon
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEdit}>
            <DialogBody className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Category Name
                </Label>
                <div className="flex gap-2">
                  <IconPickerField
                    value={editForm.watch("icon")}
                    fallback={{ name: editForm.watch("name"), kind: edit?.kind }}
                    onChange={(key) => editForm.setValue("icon", key)}
                  />
                  <Input className="h-11 flex-1" {...editForm.register("name")} autoFocus />
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEdit(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editForm.formState.isSubmitting} className="min-w-20">
                {editForm.formState.isSubmitting ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CategoriesPage() {
  const { categories: expenseCategories } = useCategories("expense");
  const { categories: incomeCategories } = useCategories("income");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">Categories</h1>
        <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
          Organize your transactions with custom categories
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <SettingsStatTile
          label="Expense Categories"
          icon={TrendingDown}
          iconWrapClassName="bg-rose-500/10"
          iconClassName="text-rose-600"
          value={expenseCategories.length}
          sub="for tracking expenses"
        />
        <SettingsStatTile
          label="Income Categories"
          icon={TrendingUp}
          iconWrapClassName="bg-emerald-500/10"
          iconClassName="text-emerald-600"
          value={incomeCategories.length}
          sub="for tracking income"
        />
      </div>

      {/* Category Tabs */}
      <Tabs defaultValue="expense" className="space-y-6">
        <TabsList>
          <TabsTrigger value="expense" className="gap-2">
            <TrendingDown className="h-4 w-4" />
            Expenses
            <Badge variant="secondary" className="ml-1">
              {expenseCategories.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="income" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Income
            <Badge variant="secondary" className="ml-1">
              {incomeCategories.length}
            </Badge>
          </TabsTrigger>
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
