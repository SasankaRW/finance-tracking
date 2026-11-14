import { z } from "zod";

export const transactionKindFormSchema = z.enum(["expense", "income", "transfer"]);

// Shared by the transaction create dialog and the transactions list's edit dialog — keeping one
// copy means a validation change (e.g. a new required field) only has to be made once.
export const transactionFormSchema = z
  .object({
    kind: transactionKindFormSchema,
    amount: z.number().positive().finite(),
    accountId: z.string().optional(),
    categoryId: z.string().optional(),
    eventId: z.string().optional(),
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

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;
