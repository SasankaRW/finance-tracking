import {
  Timestamp,
  deleteField,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { z } from "zod";
import { getFirebaseDb } from "@/lib/firebase/client";
import { accountDoc, eventDoc, transactionDoc } from "@/lib/firestore/refs";
import { DEFAULT_CURRENCY } from "@/shared/currency";
import { newId } from "@/shared/ids";

const createAccountInputSchema = z.object({
  name: z.string().min(1).max(64),
  type: z.enum(["cash", "bank", "card"]),
  currency: z.string().min(3).max(3).default(DEFAULT_CURRENCY),
  initialBalance: z.number().finite().default(0),
  includeInTotals: z.boolean().optional().default(true),
});

export async function createAccount(
  uid: string,
  input: z.infer<typeof createAccountInputSchema>,
) {
  const values = createAccountInputSchema.parse(input);
  const db = getFirebaseDb();

  const id = newId();
  const aRef = accountDoc(uid, id);

  await runTransaction(db, async (tx) => {
    tx.set(aRef, {
      schemaVersion: 1,
      id,
      name: values.name,
      type: values.type,
      currency: values.currency.toUpperCase(),
      balance: values.initialBalance,
      includeInTotals: values.includeInTotals,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return id;
}

const createIncomeExpenseInputSchema = z.object({
  kind: z.enum(["income", "expense"]),
  amount: z.number().positive().finite(),
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  eventId: z.string().min(1).optional(),
  occurredAt: z.date(),
  note: z.string().max(280).optional(),
});

export async function createIncomeOrExpense(
  uid: string,
  input: z.infer<typeof createIncomeExpenseInputSchema>,
) {
  const values = createIncomeExpenseInputSchema.parse(input);
  const db = getFirebaseDb();
  const txId = newId();

  const aRef = accountDoc(uid, values.accountId);
  const tRef = transactionDoc(uid, txId);
  const occurredAt = Timestamp.fromDate(values.occurredAt);

  await runTransaction(db, async (trx) => {
    const aSnap = await trx.get(aRef);
    if (!aSnap.exists()) throw new Error("Account not found");

    if (values.eventId) {
      const eSnap = await trx.get(eventDoc(uid, values.eventId));
      if (!eSnap.exists()) throw new Error("Event not found");
    }

    const currency = ((aSnap.data() as any).currency ?? "USD") as string;
    const prev = aSnap.data().balance as number;
    const next =
      values.kind === "income" ? prev + values.amount : prev - values.amount;

    trx.set(tRef, {
      schemaVersion: 1,
      id: txId,
      kind: values.kind,
      status: "active",
      amount: values.amount,
      currency,
      accountId: values.accountId,
      categoryId: values.categoryId,
      ...(values.eventId ? { eventId: values.eventId } : {}),
      occurredAt,
      ...(values.note ? { note: values.note } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    trx.update(aRef, {
      balance: next,
      updatedAt: serverTimestamp(),
      balanceMutationId: txId,
    });
  });

  return txId;
}

const createTransferInputSchema = z.object({
  amount: z.number().positive().finite(),
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  occurredAt: z.date(),
  note: z.string().max(280).optional(),
});

export async function createTransfer(
  uid: string,
  input: z.infer<typeof createTransferInputSchema>,
) {
  const values = createTransferInputSchema.parse(input);
  if (values.fromAccountId === values.toAccountId) {
    throw new Error("Transfer accounts must be different");
  }

  const db = getFirebaseDb();
  const txId = newId();

  const fromRef = accountDoc(uid, values.fromAccountId);
  const toRef = accountDoc(uid, values.toAccountId);
  const tRef = transactionDoc(uid, txId);
  const occurredAt = Timestamp.fromDate(values.occurredAt);

  await runTransaction(db, async (trx) => {
    const fromSnap = await trx.get(fromRef);
    const toSnap = await trx.get(toRef);
    if (!fromSnap.exists() || !toSnap.exists())
      throw new Error("Account not found");

    const fromCurrency = ((fromSnap.data() as any).currency ?? "USD") as string;
    const toCurrency = ((toSnap.data() as any).currency ?? "USD") as string;
    if (fromCurrency !== toCurrency) {
      // Multi-currency transfers need fx fields; we intentionally block for now.
      throw new Error(
        `Cross-currency transfers are not supported yet (${fromCurrency} → ${toCurrency}).`,
      );
    }

    const fromPrev = fromSnap.data().balance as number;
    const toPrev = toSnap.data().balance as number;

    trx.set(tRef, {
      schemaVersion: 1,
      id: txId,
      kind: "transfer",
      status: "active",
      amount: values.amount,
      fromAccountId: values.fromAccountId,
      toAccountId: values.toAccountId,
      currency: fromCurrency,
      fromCurrency,
      toCurrency,
      occurredAt,
      ...(values.note ? { note: values.note } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    trx.update(fromRef, {
      balance: fromPrev - values.amount,
      updatedAt: serverTimestamp(),
      balanceMutationId: txId,
    });
    trx.update(toRef, {
      balance: toPrev + values.amount,
      updatedAt: serverTimestamp(),
      balanceMutationId: txId,
    });
  });

  return txId;
}

const editTxInputSchema = z.object({
  transactionId: z.string().min(1),
  expectedUpdatedAt: z.any().optional(),
  amount: z.number().positive().finite().optional(),
  occurredAt: z.date().optional(),
  note: z.string().max(280).nullable().optional(),
  categoryId: z.string().min(1).optional(), // income/expense only
  eventId: z.string().min(1).nullable().optional(), // income/expense only
});

export async function editTransaction(
  uid: string,
  input: z.infer<typeof editTxInputSchema>,
) {
  const values = editTxInputSchema.parse(input);
  const db = getFirebaseDb();
  const tRef = transactionDoc(uid, values.transactionId);

  await runTransaction(db, async (trx) => {
    const tSnap = await trx.get(tRef);
    if (!tSnap.exists()) throw new Error("Transaction not found");
    if (
      values.expectedUpdatedAt &&
      values.expectedUpdatedAt instanceof Timestamp &&
      tSnap.data().updatedAt instanceof Timestamp &&
      !(tSnap.data().updatedAt as Timestamp).isEqual(values.expectedUpdatedAt)
    ) {
      throw new Error("Conflict: transaction was changed on another device.");
    }
    const t = tSnap.data() as any;

    if (t.status !== "active") throw new Error("Cannot edit deleted transaction");

    const kind = t.kind as "income" | "expense" | "transfer";
    const oldAmount = t.amount as number;
    const newAmount = values.amount ?? oldAmount;

    if (kind === "income" || kind === "expense") {
      if (values.categoryId && typeof t.categoryId !== "string") {
        throw new Error("Cannot set category on this transaction");
      }

      if (values.eventId !== undefined) {
        if (values.eventId) {
          const eSnap = await trx.get(eventDoc(uid, values.eventId));
          if (!eSnap.exists()) throw new Error("Event not found");
        }
      }

      const aRef = accountDoc(uid, t.accountId as string);
      const aSnap = await trx.get(aRef);
      if (!aSnap.exists()) throw new Error("Account not found");

      const prevBal = aSnap.data().balance as number;

      const effect = (k: "income" | "expense", amt: number) =>
        k === "income" ? amt : -amt;
      const delta = effect(kind, newAmount) - effect(kind, oldAmount);

      trx.update(aRef, {
        balance: prevBal + delta,
        updatedAt: serverTimestamp(),
        balanceMutationId: values.transactionId,
      });

      trx.update(tRef, {
        amount: newAmount,
        categoryId: values.categoryId ?? t.categoryId,
        ...(values.eventId === undefined
          ? {}
          : values.eventId
            ? { eventId: values.eventId }
            : { eventId: deleteField() }),
        occurredAt: values.occurredAt
          ? Timestamp.fromDate(values.occurredAt)
          : t.occurredAt,
        ...(values.note === undefined
          ? {}
          : values.note
            ? { note: values.note }
            : { note: "" }),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    // transfer
    const fromRef = accountDoc(uid, t.fromAccountId as string);
    const toRef = accountDoc(uid, t.toAccountId as string);
    const fromSnap = await trx.get(fromRef);
    const toSnap = await trx.get(toRef);
    if (!fromSnap.exists() || !toSnap.exists())
      throw new Error("Account not found");

    const fromPrev = fromSnap.data().balance as number;
    const toPrev = toSnap.data().balance as number;
    const delta = newAmount - oldAmount;

    trx.update(fromRef, {
      balance: fromPrev - delta,
      updatedAt: serverTimestamp(),
      balanceMutationId: values.transactionId,
    });
    trx.update(toRef, {
      balance: toPrev + delta,
      updatedAt: serverTimestamp(),
      balanceMutationId: values.transactionId,
    });

    trx.update(tRef, {
      amount: newAmount,
      occurredAt: values.occurredAt
        ? Timestamp.fromDate(values.occurredAt)
        : t.occurredAt,
      ...(values.note === undefined
        ? {}
        : values.note
          ? { note: values.note }
          : { note: "" }),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function deleteTransaction(
  uid: string,
  transactionId: string,
  expectedUpdatedAt?: Timestamp,
) {
  const db = getFirebaseDb();
  const tRef = transactionDoc(uid, transactionId);

  await runTransaction(db, async (trx) => {
    const tSnap = await trx.get(tRef);
    if (!tSnap.exists()) throw new Error("Transaction not found");
    if (
      expectedUpdatedAt &&
      tSnap.data().updatedAt instanceof Timestamp &&
      !(tSnap.data().updatedAt as Timestamp).isEqual(expectedUpdatedAt)
    ) {
      throw new Error("Conflict: transaction was changed on another device.");
    }
    const t = tSnap.data() as any;
    if (t.status !== "active") return;

    const kind = t.kind as "income" | "expense" | "transfer";
    const amount = t.amount as number;

    if (kind === "income" || kind === "expense") {
      const aRef = accountDoc(uid, t.accountId as string);
      const aSnap = await trx.get(aRef);
      if (!aSnap.exists()) throw new Error("Account not found");
      const prev = aSnap.data().balance as number;
      const delta = kind === "income" ? -amount : amount;
      trx.update(aRef, {
        balance: prev + delta,
        updatedAt: serverTimestamp(),
        balanceMutationId: transactionId,
      });
    } else {
      const fromRef = accountDoc(uid, t.fromAccountId as string);
      const toRef = accountDoc(uid, t.toAccountId as string);
      const fromSnap = await trx.get(fromRef);
      const toSnap = await trx.get(toRef);
      if (!fromSnap.exists() || !toSnap.exists())
        throw new Error("Account not found");

      const fromPrev = fromSnap.data().balance as number;
      const toPrev = toSnap.data().balance as number;
      trx.update(fromRef, {
        balance: fromPrev + amount,
        updatedAt: serverTimestamp(),
        balanceMutationId: transactionId,
      });
      trx.update(toRef, {
        balance: toPrev - amount,
        updatedAt: serverTimestamp(),
        balanceMutationId: transactionId,
      });
    }

    trx.update(tRef, {
      status: "deleted",
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}


