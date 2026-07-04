import { z } from "zod";

export const accountTypeSchema = z.enum(["cash", "bank", "card"]);
export type AccountType = z.infer<typeof accountTypeSchema>;

export const categoryKindSchema = z.enum(["income", "expense"]);
export type CategoryKind = z.infer<typeof categoryKindSchema>;

export const transactionKindSchema = z.enum(["income", "expense", "transfer"]);
export type TransactionKind = z.infer<typeof transactionKindSchema>;

export const transactionStatusSchema = z.enum(["active", "deleted"]);
export type TransactionStatus = z.infer<typeof transactionStatusSchema>;

export const eventStatusSchema = z.enum(["active", "archived"]);
export type EventStatus = z.infer<typeof eventStatusSchema>;

export const subscriptionIntervalSchema = z.enum(["monthly"]);
export type SubscriptionInterval = z.infer<typeof subscriptionIntervalSchema>;

export const subscriptionStatusSchema = z.enum(["active", "paused", "completed"]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const debtDirectionSchema = z.enum(["owed_to_me", "i_owe"]);
export type DebtDirection = z.infer<typeof debtDirectionSchema>;

export const debtStatusSchema = z.enum(["active", "settled"]);
export type DebtStatus = z.infer<typeof debtStatusSchema>;

export const salaryStatusSchema = z.enum(["active", "paused"]);
export type SalaryStatus = z.infer<typeof salaryStatusSchema>;

export const salaryDepositModeSchema = z.enum(["keep_salary_currency", "convert_to_account_currency"]);
export type SalaryDepositMode = z.infer<typeof salaryDepositModeSchema>;

// Firestore stores timestamps as its Timestamp type. In rules we validate timestamps.
// At runtime we accept any value and validate shape at the edge (write paths).
const firestoreTimestampLikeSchema = z.any();

export const accountDocSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1).max(64),
  type: accountTypeSchema,
  currency: z.string().min(3).max(3).optional(), // ISO 4217 (default handled in app)
  balance: z.number().finite(),
  includeInTotals: z.boolean().optional(),
  balanceMutationId: z.string().min(1).optional(),
  createdAt: firestoreTimestampLikeSchema,
  updatedAt: firestoreTimestampLikeSchema,
});
export type AccountDoc = z.infer<typeof accountDocSchema>;

export const categoryDocSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  kind: categoryKindSchema,
  name: z.string().min(1).max(48),
  createdAt: firestoreTimestampLikeSchema,
  updatedAt: firestoreTimestampLikeSchema,
});
export type CategoryDoc = z.infer<typeof categoryDocSchema>;

export const transactionDocSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1),
    kind: transactionKindSchema,
    status: transactionStatusSchema,
    amount: z.number().positive().finite(),
    currency: z.string().min(3).max(3).optional(),

    // income/expense:
    accountId: z.string().min(1).optional(),
    categoryId: z.string().min(1).optional(),
    eventId: z.string().min(1).optional(),

    // transfer:
    fromAccountId: z.string().min(1).optional(),
    toAccountId: z.string().min(1).optional(),
    fromCurrency: z.string().min(3).max(3).optional(),
    toCurrency: z.string().min(3).max(3).optional(),

    occurredAt: firestoreTimestampLikeSchema,
    note: z.string().max(280).optional(),

    createdAt: firestoreTimestampLikeSchema,
    updatedAt: firestoreTimestampLikeSchema,
    deletedAt: firestoreTimestampLikeSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "transfer") {
      if (!v.fromAccountId || !v.toAccountId) {
        ctx.addIssue({
          code: "custom",
          path: ["fromAccountId"],
          message: "Transfer requires fromAccountId and toAccountId",
        });
      }
      if (v.fromAccountId && v.toAccountId && v.fromAccountId === v.toAccountId) {
        ctx.addIssue({
          code: "custom",
          path: ["toAccountId"],
          message: "Transfer accounts must be different",
        });
      }
    } else {
      if (!v.accountId) {
        ctx.addIssue({
          code: "custom",
          path: ["accountId"],
          message: "Transaction requires accountId",
        });
      }
      if (!v.categoryId) {
        ctx.addIssue({
          code: "custom",
          path: ["categoryId"],
          message: "Transaction requires categoryId",
        });
      }
    }
  });
export type TransactionDoc = z.infer<typeof transactionDocSchema>;

export const eventDocSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1),
    status: eventStatusSchema,
    name: z.string().min(1).max(64),
    currency: z.string().min(3).max(3),
    budgetMin: z.number().finite().min(0),
    budgetMax: z.number().finite().min(0),
    startAt: firestoreTimestampLikeSchema.optional(),
    endAt: firestoreTimestampLikeSchema.optional(),
    defaultAccountId: z.string().min(1).optional(),
    createdAt: firestoreTimestampLikeSchema,
    updatedAt: firestoreTimestampLikeSchema,
  })
  .superRefine((v, ctx) => {
    if (v.budgetMax < v.budgetMin) {
      ctx.addIssue({
        code: "custom",
        path: ["budgetMax"],
        message: "budgetMax must be >= budgetMin",
      });
    }
  });
export type EventDoc = z.infer<typeof eventDocSchema>;

export const subscriptionDocSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1).max(64),
  kind: z.enum(["subscription", "loan"]).optional(),
  amount: z.number().positive().finite(),
  currency: z.string().min(3).max(3),
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  interval: subscriptionIntervalSchema,
  status: subscriptionStatusSchema,
  loanTotalPayments: z.number().int().positive().optional(),
  loanPaidPayments: z.number().int().min(0).optional(),
  nextDueAt: firestoreTimestampLikeSchema,
  lastPaidAt: firestoreTimestampLikeSchema.optional(),
  createdAt: firestoreTimestampLikeSchema,
  updatedAt: firestoreTimestampLikeSchema,
});
export type SubscriptionDoc = z.infer<typeof subscriptionDocSchema>;

export const debtDocSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  personName: z.string().min(1).max(64),
  direction: debtDirectionSchema,
  status: debtStatusSchema,
  amount: z.number().positive().finite(),
  currency: z.string().min(3).max(3),
  note: z.string().max(160).optional(),
  dueAt: firestoreTimestampLikeSchema.optional(),
  settledAt: firestoreTimestampLikeSchema.optional(),
  settledAccountId: z.string().min(1).optional(),
  settledTransactionId: z.string().min(1).optional(),
  createdAt: firestoreTimestampLikeSchema,
  updatedAt: firestoreTimestampLikeSchema,
});
export type DebtDoc = z.infer<typeof debtDocSchema>;

export const salaryProfileDocSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  employerName: z.string().min(1).max(64),
  amount: z.number().positive().finite(),
  currency: z.string().min(3).max(3),
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  status: salaryStatusSchema,
  depositMode: salaryDepositModeSchema.optional(),
  nextPaydayAt: firestoreTimestampLikeSchema,
  lastPaidAt: firestoreTimestampLikeSchema.optional(),
  createdAt: firestoreTimestampLikeSchema,
  updatedAt: firestoreTimestampLikeSchema,
});
export type SalaryProfileDoc = z.infer<typeof salaryProfileDocSchema>;


