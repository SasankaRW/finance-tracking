import type { CategoryKind } from "@/shared/finance-schemas";

export type DefaultCategory = {
  kind: CategoryKind;
  name: string;
};

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // Income
  { kind: "income", name: "Salary" },
  { kind: "income", name: "Bonus" },
  { kind: "income", name: "Freelance" },
  { kind: "income", name: "Interest" },
  { kind: "income", name: "Gift" },

  // Expenses
  { kind: "expense", name: "Groceries" },
  { kind: "expense", name: "Rent / Mortgage" },
  { kind: "expense", name: "Utilities" },
  { kind: "expense", name: "Transportation" },
  { kind: "expense", name: "Dining" },
  { kind: "expense", name: "Shopping" },
  { kind: "expense", name: "Subscriptions" },
  { kind: "expense", name: "Healthcare" },
  { kind: "expense", name: "Entertainment" },
];














