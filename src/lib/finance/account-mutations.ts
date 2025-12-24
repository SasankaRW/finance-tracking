import { runTransaction, serverTimestamp } from "firebase/firestore";
import { z } from "zod";
import { accountDoc } from "@/lib/firestore/refs";
import { getFirebaseDb } from "@/lib/firebase/client";

const updateAccountInputSchema = z.object({
  accountId: z.string().min(1),
  name: z.string().min(1).max(64),
  type: z.enum(["cash", "bank", "card"]),
  currency: z.string().min(3).max(3).optional(),
});

export async function updateAccount(
  uid: string,
  input: z.infer<typeof updateAccountInputSchema>,
) {
  const values = updateAccountInputSchema.parse(input);
  const db = getFirebaseDb();
  const ref = accountDoc(uid, values.accountId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Account not found");
    tx.update(ref, {
      name: values.name,
      type: values.type,
      ...(values.currency ? { currency: values.currency.toUpperCase() } : {}),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function deleteAccount(uid: string, accountId: string) {
  const db = getFirebaseDb();
  const ref = accountDoc(uid, accountId);
  await runTransaction(db, async (tx) => {
    tx.delete(ref);
  });
}


