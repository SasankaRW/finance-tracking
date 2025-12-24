import { z } from "zod";

// Monthly budgets, stored as "YYYY-MM" to keep queries simple.
export const yearMonthSchema = z.string().regex(/^\d{4}-\d{2}$/);

export const budgetDocSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),

  // "YYYY-MM"
  month: yearMonthSchema,

  // If omitted, this is an "overall" expense budget for the month.
  categoryId: z.string().min(1).optional(),

  // Amount in currency.
  limitAmount: z.number().positive().finite(),
  currency: z.string().min(3).max(3),

  createdAt: z.any(),
  updatedAt: z.any(),
});

export type BudgetDoc = z.infer<typeof budgetDocSchema>;


