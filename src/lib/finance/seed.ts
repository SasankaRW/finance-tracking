import {
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { profileDoc, categoryDoc } from "@/lib/firestore/refs";
import { DEFAULT_CATEGORIES } from "@/lib/finance/default-categories";
import { newId } from "@/shared/ids";

export async function ensureDefaultCategoriesSeeded(uid: string) {
  const db = getFirebaseDb();
  await runTransaction(db, async (tx) => {
    const pRef = profileDoc(uid);
    const pSnap = await tx.get(pRef);

    const alreadySeeded =
      pSnap.exists() && Boolean(pSnap.data().categoriesSeededAt);
    if (alreadySeeded) return;

    // Mark profile as seeded first (still inside the same transaction).
    if (!pSnap.exists()) {
      tx.set(pRef, {
        schemaVersion: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        categoriesSeededAt: serverTimestamp(),
      });
    } else {
      tx.update(pRef, {
        updatedAt: serverTimestamp(),
        categoriesSeededAt: serverTimestamp(),
      });
    }

    for (const c of DEFAULT_CATEGORIES) {
      const id = newId();
      const cRef = categoryDoc(uid, id);
      tx.set(cRef, {
        schemaVersion: 1,
        id,
        kind: c.kind,
        name: c.name,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  });
}


