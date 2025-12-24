import { runTransaction, serverTimestamp } from "firebase/firestore";
import { z } from "zod";
import { getFirebaseDb } from "@/lib/firebase/client";
import { budgetDoc } from "@/lib/firestore/refs";
import { newId } from "@/shared/ids";
import { yearMonthSchema } from "@/shared/budget-schemas";

const createBudgetInputSchema = z.object({
  month: yearMonthSchema,
  categoryId: z.string().min(1).optional(),
  limitAmount: z.number().positive().finite(),
  currency: z.string().min(3).max(3),
});

export async function createBudget(
  uid: string,
  input: z.infer<typeof createBudgetInputSchema>,
) {
  const values = createBudgetInputSchema.parse(input);
  const db = getFirebaseDb();
  const id = newId();
  const ref = budgetDoc(uid, id);

  await runTransaction(db, async (tx) => {
    tx.set(ref, {
      schemaVersion: 1,
      id,
      month: values.month,
      ...(values.categoryId ? { categoryId: values.categoryId } : {}),
      limitAmount: values.limitAmount,
      currency: values.currency.toUpperCase(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return id;
}

const updateBudgetInputSchema = z.object({
  budgetId: z.string().min(1),
  limitAmount: z.number().positive().finite(),
});

export async function updateBudget(
  uid: string,
  input: z.infer<typeof updateBudgetInputSchema>,
) {
  const values = updateBudgetInputSchema.parse(input);
  const db = getFirebaseDb();
  const ref = budgetDoc(uid, values.budgetId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Budget not found");
    tx.update(ref, {
      limitAmount: values.limitAmount,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function deleteBudget(uid: string, budgetId: string) {
  const db = getFirebaseDb();
  const ref = budgetDoc(uid, budgetId);
  await runTransaction(db, async (tx) => {
    tx.delete(ref);
  });
}


