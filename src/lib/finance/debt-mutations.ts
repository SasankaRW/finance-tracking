import {
  Timestamp,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { z } from "zod";
import { getFirebaseDb } from "@/lib/firebase/client";
import {
  accountDoc,
  categoriesCol,
  debtDoc,
  transactionDoc,
} from "@/lib/firestore/refs";
import { formatCurrencyCode } from "@/lib/format";
import { DEFAULT_CURRENCY } from "@/shared/currency";
import { newId } from "@/shared/ids";

async function resolveSettlementCategoryId(
  uid: string,
  kind: "income" | "expense",
) {
  const snap = await getDocs(
    query(categoriesCol(uid), where("kind", "==", kind)),
  );
  const preferredName = kind === "income" ? "Gift" : "Shopping";
  const preferred = snap.docs.find((d) => d.data().name === preferredName);
  const id = preferred?.id ?? snap.docs[0]?.id;
  if (!id) {
    throw new Error(
      kind === "income"
        ? "Add an income category first"
        : "Add an expense category first",
    );
  }
  return id;
}

const createDebtInputSchema = z.object({
  personName: z.string().min(1).max(64),
  direction: z.enum(["owed_to_me", "i_owe"]),
  amount: z.number().positive().finite(),
  currency: z.string().min(3).max(3).default(DEFAULT_CURRENCY),
  dueAt: z.date().optional(),
  note: z.string().max(160).optional(),
});

export async function createDebt(uid: string, input: z.infer<typeof createDebtInputSchema>) {
  const values = createDebtInputSchema.parse(input);
  const db = getFirebaseDb();
  const id = newId();
  const ref = debtDoc(uid, id);

  await runTransaction(db, async (tx) => {
    tx.set(ref, {
      schemaVersion: 1,
      id,
      personName: values.personName,
      direction: values.direction,
      amount: values.amount,
      currency: values.currency.toUpperCase(),
      status: "active",
      ...(values.dueAt ? { dueAt: Timestamp.fromDate(values.dueAt) } : {}),
      ...(values.note ? { note: values.note } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return id;
}

/**
 * Marks a debt as settled. When `accountId` is provided, records an income/expense
 * transaction and updates the account balance in the same Firestore transaction.
 */
export async function settleDebt(uid: string, debtId: string, accountId?: string) {
  const db = getFirebaseDb();
  const ref = debtDoc(uid, debtId);

  const debtSnap = await getDoc(ref);
  if (!debtSnap.exists()) throw new Error("Debt not found");
  const debtPreview = debtSnap.data() as any;
  if (debtPreview.status === "settled") throw new Error("Already settled");

  const settlementKind =
    debtPreview.direction === "owed_to_me" ? "income" : "expense";
  const categoryId = accountId
    ? await resolveSettlementCategoryId(uid, settlementKind)
    : null;

  const aRef = accountId ? accountDoc(uid, accountId) : null;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Debt not found");
    const debt = snap.data() as any;
    if (debt.status === "settled") throw new Error("Already settled");

    let settlementTxId: string | undefined;

    if (aRef && categoryId) {
      const aSnap = await tx.get(aRef);
      if (!aSnap.exists()) throw new Error("Account not found");

      const accountCurrency = formatCurrencyCode((aSnap.data() as any).currency);
      const debtCurrency = formatCurrencyCode(debt.currency);
      if (accountCurrency !== debtCurrency) {
        throw new Error(
          `Pick a ${debtCurrency} account, or convert manually (account is ${accountCurrency}).`,
        );
      }

      const kind = debt.direction === "owed_to_me" ? "income" : "expense";
      const prevBalance = aSnap.data().balance as number;
      const delta = debt.direction === "owed_to_me" ? debt.amount : -debt.amount;
      settlementTxId = newId();
      const tRef = transactionDoc(uid, settlementTxId);
      const personName = debt.personName ?? "Someone";
      const note =
        debt.direction === "owed_to_me"
          ? `Received from ${personName}`
          : `Paid to ${personName}`;

      tx.set(tRef, {
        schemaVersion: 1,
        id: settlementTxId,
        kind,
        status: "active",
        amount: debt.amount,
        currency: accountCurrency,
        accountId,
        categoryId,
        occurredAt: Timestamp.fromDate(new Date()),
        note,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      tx.update(aRef, {
        balance: prevBalance + delta,
        updatedAt: serverTimestamp(),
        balanceMutationId: settlementTxId,
      });
    }

    tx.update(ref, {
      status: "settled",
      settledAt: serverTimestamp(),
      ...(accountId ? { settledAccountId: accountId } : {}),
      ...(settlementTxId ? { settledTransactionId: settlementTxId } : {}),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function deleteDebt(uid: string, debtId: string) {
  const db = getFirebaseDb();
  const ref = debtDoc(uid, debtId);

  await runTransaction(db, async (tx) => {
    tx.delete(ref);
  });
}
