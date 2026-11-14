import { Timestamp, deleteField, runTransaction, serverTimestamp } from "firebase/firestore";
import { addMonths } from "date-fns";
import { z } from "zod";
import { getFirebaseDb } from "@/lib/firebase/client";
import { accountDoc, subscriptionDoc, transactionDoc } from "@/lib/firestore/refs";
import { DEFAULT_CURRENCY } from "@/shared/currency";
import { formatCurrencyCode } from "@/lib/format";
import { newId } from "@/shared/ids";

async function fetchFxRate(base: string, symbol: string) {
  const b = formatCurrencyCode(base);
  const s = formatCurrencyCode(symbol);
  
  // For static export, call the external API directly
  const upstream = await fetch(`https://open.er-api.com/v6/latest/${b}`);
  
  if (!upstream.ok) {
    throw new Error("Failed to fetch FX rates");
  }

  const json = (await upstream.json()) as any;
  if (json?.result !== "success" || typeof json?.rates !== "object") {
    throw new Error("Unexpected FX response");
  }

  const rate = json.rates[s];
  if (typeof rate !== "number") {
    throw new Error(`Missing FX rate: ${b}→${s}`);
  }
  
  return rate as number;
}

function round2(x: number) {
  return Math.round(x * 100) / 100;
}

const createSubscriptionInputSchema = z.object({
  name: z.string().min(1).max(64),
  kind: z.enum(["subscription", "loan", "rent"]).default("subscription"),
  amount: z.number().positive().finite(),
  currency: z.string().min(3).max(3).default(DEFAULT_CURRENCY),
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  nextDueAt: z.date(),
  interval: z.enum(["monthly"]).default("monthly"),
  loanTotalPayments: z.number().int().positive().optional(),
  loanPaidPayments: z.number().int().min(0).optional(),
}).superRefine((values, ctx) => {
  if (values.kind !== "loan") return;

  if (!values.loanTotalPayments) {
    ctx.addIssue({
      code: "custom",
      path: ["loanTotalPayments"],
      message: "Loan needs total months",
    });
  }

  if ((values.loanPaidPayments ?? 0) > (values.loanTotalPayments ?? 0)) {
    ctx.addIssue({
      code: "custom",
      path: ["loanPaidPayments"],
      message: "Paid months cannot be greater than total months",
    });
  }
});

export async function createSubscription(
  uid: string,
  input: z.infer<typeof createSubscriptionInputSchema>,
) {
  const values = createSubscriptionInputSchema.parse(input);
  const db = getFirebaseDb();
  const id = newId();
  const ref = subscriptionDoc(uid, id);

  await runTransaction(db, async (tx) => {
    const payload = {
      schemaVersion: 1,
      id,
      name: values.name,
      kind: values.kind,
      amount: values.amount,
      currency: values.currency.toUpperCase(),
      accountId: values.accountId,
      categoryId: values.categoryId,
      interval: values.interval,
      status: "active",
      ...(values.kind === "loan"
        ? {
            loanTotalPayments: values.loanTotalPayments,
            loanPaidPayments: values.loanPaidPayments ?? 0,
          }
        : {}),
      nextDueAt: Timestamp.fromDate(values.nextDueAt),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    tx.set(ref, payload);
  });

  return id;
}

const updateSubscriptionInputSchema = z.object({
  subscriptionId: z.string().min(1),
  name: z.string().min(1).max(64),
  kind: z.enum(["subscription", "loan", "rent"]).default("subscription"),
  amount: z.number().positive().finite(),
  currency: z.string().min(3).max(3).default(DEFAULT_CURRENCY),
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  nextDueAt: z.date(),
  interval: z.enum(["monthly"]).default("monthly"),
  status: z.enum(["active", "paused", "completed"]).default("active"),
  loanTotalPayments: z.number().int().positive().optional(),
  loanPaidPayments: z.number().int().min(0).optional(),
}).superRefine((values, ctx) => {
  if (values.kind !== "loan") return;

  if (!values.loanTotalPayments) {
    ctx.addIssue({
      code: "custom",
      path: ["loanTotalPayments"],
      message: "Loan needs total months",
    });
  }

  if ((values.loanPaidPayments ?? 0) > (values.loanTotalPayments ?? 0)) {
    ctx.addIssue({
      code: "custom",
      path: ["loanPaidPayments"],
      message: "Paid months cannot be greater than total months",
    });
  }
});

export async function updateSubscription(
  uid: string,
  input: z.infer<typeof updateSubscriptionInputSchema>,
) {
  const values = updateSubscriptionInputSchema.parse(input);
  const db = getFirebaseDb();
  const ref = subscriptionDoc(uid, values.subscriptionId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Subscription not found");
    const payload = {
      name: values.name,
      kind: values.kind,
      amount: values.amount,
      currency: values.currency.toUpperCase(),
      accountId: values.accountId,
      categoryId: values.categoryId,
      interval: values.interval,
      status: values.status,
      loanTotalPayments:
        values.kind === "loan" ? values.loanTotalPayments : deleteField(),
      loanPaidPayments:
        values.kind === "loan" ? values.loanPaidPayments ?? 0 : deleteField(),
      nextDueAt: Timestamp.fromDate(values.nextDueAt),
      updatedAt: serverTimestamp(),
    };

    tx.update(ref, payload);
  });
}

export async function setSubscriptionStatus(
  uid: string,
  subscriptionId: string,
  status: "active" | "paused",
) {
  const db = getFirebaseDb();
  const ref = subscriptionDoc(uid, subscriptionId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Subscription not found");
    tx.update(ref, { status, updatedAt: serverTimestamp() });
  });
}

export async function deleteSubscription(uid: string, subscriptionId: string) {
  const db = getFirebaseDb();
  const ref = subscriptionDoc(uid, subscriptionId);
  await runTransaction(db, async (tx) => {
    tx.delete(ref);
  });
}

export async function recordSubscriptionPayment(
  uid: string,
  subscriptionId: string,
  occurredAtDate: Date = new Date(),
) {
  const db = getFirebaseDb();
  const sRef = subscriptionDoc(uid, subscriptionId);

  await runTransaction(db, async (trx) => {
    const sSnap = await trx.get(sRef);
    if (!sSnap.exists()) throw new Error("Subscription not found");
    const s = sSnap.data() as any;
    if (s.status !== "active") throw new Error("Subscription is not active");

    const accountId = s.accountId as string;
    const categoryId = s.categoryId as string;
    const amount = s.amount as number;
    const subCurrency = formatCurrencyCode(s.currency ?? DEFAULT_CURRENCY);

    const aRef = accountDoc(uid, accountId);
    const aSnap = await trx.get(aRef);
    if (!aSnap.exists()) throw new Error("Account not found");

    const accountCurrency = formatCurrencyCode((aSnap.data() as any).currency ?? DEFAULT_CURRENCY);
    const prev = aSnap.data().balance as number;

    let amountInAccountCurrency = amount;
    let fxRate: number | null = null;
    if (subCurrency !== accountCurrency) {
      fxRate = await fetchFxRate(subCurrency, accountCurrency);
      amountInAccountCurrency = round2(amount * fxRate);
    }
    const next = prev - amountInAccountCurrency;

    const txId = newId();
    const tRef = transactionDoc(uid, txId);
    const occurredAt = Timestamp.fromDate(occurredAtDate);

    // Create an expense transaction and mutate balance exactly like createIncomeOrExpense.
    trx.set(tRef, {
      schemaVersion: 1,
      id: txId,
      kind: "expense",
      status: "active",
      amount: amountInAccountCurrency,
      currency: accountCurrency,
      accountId,
      categoryId,
      subscriptionId,
      occurredAt,
      note: `${s.kind === "loan" ? "Loan payment" : s.kind === "rent" ? "Rent" : "Subscription"}: ${s.name ?? "Payment"}`,
      ...(fxRate
        ? {
            fxOriginalAmount: amount,
            fxOriginalCurrency: subCurrency,
            fxRate,
          }
        : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    trx.update(aRef, {
      balance: next,
      updatedAt: serverTimestamp(),
      balanceMutationId: txId,
    });

    const currentNextDue =
      s.nextDueAt instanceof Timestamp ? s.nextDueAt.toDate() : new Date();
    const nextDueAt = Timestamp.fromDate(addMonths(currentNextDue, 1));
    const isLoan = s.kind === "loan";
    const loanTotalPayments =
      typeof s.loanTotalPayments === "number" ? s.loanTotalPayments : null;
    const loanPaidPayments =
      typeof s.loanPaidPayments === "number" ? s.loanPaidPayments : 0;
    const nextLoanPaidPayments = isLoan ? loanPaidPayments + 1 : null;
    const loanCompleted =
      isLoan && loanTotalPayments != null && nextLoanPaidPayments! >= loanTotalPayments;

    trx.update(sRef, {
      lastPaidAt: serverTimestamp(),
      nextDueAt,
      ...(isLoan
        ? {
            loanPaidPayments: nextLoanPaidPayments,
            status: loanCompleted ? "completed" : "active",
          }
        : {}),
      updatedAt: serverTimestamp(),
    });
  });
}


