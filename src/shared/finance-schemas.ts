import { z } from "zod";

export const accountTypeSchema = z.enum(["cash", "bank", "card"]);
export type AccountType = z.infer<typeof accountTypeSchema>;

export const categoryKindSchema = z.enum(["income", "expense"]);
export type CategoryKind = z.infer<typeof categoryKindSchema>;

export const transactionKindSchema = z.enum(["income", "expense", "transfer"]);
export type TransactionKind = z.infer<typeof transactionKindSchema>;

export const transactionStatusSchema = z.enum(["active", "deleted"]);
export type TransactionStatus = z.infer<typeof transactionStatusSchema>;

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


