import { runTransaction, serverTimestamp } from "firebase/firestore";
import { z } from "zod";
import { categoryDoc } from "@/lib/firestore/refs";
import { getFirebaseDb } from "@/lib/firebase/client";
import { newId } from "@/shared/ids";

const createCategoryInputSchema = z.object({
  kind: z.enum(["income", "expense"]),
  name: z.string().min(1).max(48),
});

export async function createCategory(
  uid: string,
  input: z.infer<typeof createCategoryInputSchema>,
) {
  const values = createCategoryInputSchema.parse(input);
  const db = getFirebaseDb();
  const id = newId();
  const ref = categoryDoc(uid, id);

  await runTransaction(db, async (tx) => {
    tx.set(ref, {
      schemaVersion: 1,
      id,
      kind: values.kind,
      name: values.name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return id;
}

const renameCategoryInputSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1).max(48),
});

export async function renameCategory(
  uid: string,
  input: z.infer<typeof renameCategoryInputSchema>,
) {
  const values = renameCategoryInputSchema.parse(input);
  const db = getFirebaseDb();
  const ref = categoryDoc(uid, values.categoryId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Category not found");
    tx.update(ref, {
      name: values.name,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function deleteCategory(uid: string, categoryId: string) {
  const db = getFirebaseDb();
  const ref = categoryDoc(uid, categoryId);
  await runTransaction(db, async (tx) => {
    tx.delete(ref);
  });
}














