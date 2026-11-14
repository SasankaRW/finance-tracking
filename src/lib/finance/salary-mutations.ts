import { addMonths, isAfter } from "date-fns";
import { Timestamp, runTransaction, serverTimestamp } from "firebase/firestore";
import { z } from "zod";
import { getFirebaseDb } from "@/lib/firebase/client";
import { accountDoc, salaryProfileDoc, transactionDoc } from "@/lib/firestore/refs";
import { formatCurrencyCode } from "@/lib/format";
import { DEFAULT_CURRENCY } from "@/shared/currency";
import { newId } from "@/shared/ids";

async function fetchFxRate(base: string, symbol: string) {
  const b = formatCurrencyCode(base);
  const s = formatCurrencyCode(symbol);

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
    throw new Error(`Missing FX rate: ${b} to ${s}`);
  }

  return rate as number;
}

function round2(x: number) {
  return Math.round(x * 100) / 100;
}

const salaryInputSchema = z.object({
  employerName: z.string().min(1).max(64),
  amount: z.number().positive().finite(),
  currency: z.string().min(3).max(3).default(DEFAULT_CURRENCY),
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  depositMode: z.enum(["keep_salary_currency", "convert_to_account_currency"]).default("convert_to_account_currency"),
  // Fraction withheld (tax, etc.) between gross converted pay and what actually lands in the account, e.g. 0.1375 for 13.75%.
  taxRate: z.number().min(0).max(1).optional(),
  nextPaydayAt: z.date(),
});

const updateSalaryInputSchema = salaryInputSchema.extend({
  salaryProfileId: z.string().min(1),
  status: z.enum(["active", "paused"]).default("active"),
});

function nextMonthlyPayday(current: Date, after: Date) {
  let next = addMonths(current, 1);
  while (!isAfter(next, after)) {
    next = addMonths(next, 1);
  }
  return next;
}

export async function createSalaryProfile(
  uid: string,
  input: z.infer<typeof salaryInputSchema>,
) {
  const values = salaryInputSchema.parse(input);
  const db = getFirebaseDb();
  const id = newId();
  const ref = salaryProfileDoc(uid, id);

  await runTransaction(db, async (tx) => {
    const aSnap = await tx.get(accountDoc(uid, values.accountId));
    if (!aSnap.exists()) throw new Error("Account not found");

    tx.set(ref, {
      schemaVersion: 1,
      id,
      employerName: values.employerName,
      amount: values.amount,
      currency: values.currency.toUpperCase(),
      accountId: values.accountId,
      categoryId: values.categoryId,
      depositMode: values.depositMode,
      taxRate: values.taxRate ?? null,
      status: "active",
      nextPaydayAt: Timestamp.fromDate(values.nextPaydayAt),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return id;
}

export async function updateSalaryProfile(
  uid: string,
  input: z.infer<typeof updateSalaryInputSchema>,
) {
  const values = updateSalaryInputSchema.parse(input);
  const db = getFirebaseDb();
  const ref = salaryProfileDoc(uid, values.salaryProfileId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Salary profile not found");
    const aSnap = await tx.get(accountDoc(uid, values.accountId));
    if (!aSnap.exists()) throw new Error("Account not found");

    tx.update(ref, {
      employerName: values.employerName,
      amount: values.amount,
      currency: values.currency.toUpperCase(),
      accountId: values.accountId,
      categoryId: values.categoryId,
      depositMode: values.depositMode,
      taxRate: values.taxRate ?? null,
      status: values.status,
      nextPaydayAt: Timestamp.fromDate(values.nextPaydayAt),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function setSalaryProfileStatus(
  uid: string,
  salaryProfileId: string,
  status: "active" | "paused",
) {
  const db = getFirebaseDb();
  const ref = salaryProfileDoc(uid, salaryProfileId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Salary profile not found");
    tx.update(ref, { status, updatedAt: serverTimestamp() });
  });
}

export async function deleteSalaryProfile(uid: string, salaryProfileId: string) {
  const db = getFirebaseDb();
  const ref = salaryProfileDoc(uid, salaryProfileId);

  await runTransaction(db, async (tx) => {
    tx.delete(ref);
  });
}

function clampTaxRate(rate: number) {
  if (!Number.isFinite(rate)) return 0;
  return Math.min(0.95, Math.max(0, rate));
}

/**
 * Records one salary payday. `receivedAmount`, when provided, is what actually landed in the
 * account (in the account's currency) and overrides the tax-adjusted estimate. Since gross pay
 * and the tax/withholding rate are rarely exact, the profile's stored taxRate is recalibrated
 * from the gap between the pre-tax converted amount and receivedAmount so future estimates track
 * the real deduction.
 */
export async function recordSalaryPayment(
  uid: string,
  salaryProfileId: string,
  occurredAtDate: Date = new Date(),
  receivedAmount?: number,
) {
  const db = getFirebaseDb();
  const sRef = salaryProfileDoc(uid, salaryProfileId);

  await runTransaction(db, async (trx) => {
    const sSnap = await trx.get(sRef);
    if (!sSnap.exists()) throw new Error("Salary profile not found");
    const salary = sSnap.data() as any;
    if (salary.status !== "active") throw new Error("Salary profile is paused");

    const accountId = salary.accountId as string;
    const aRef = accountDoc(uid, accountId);
    const aSnap = await trx.get(aRef);
    if (!aSnap.exists()) throw new Error("Account not found");

    const accountCurrency = formatCurrencyCode((aSnap.data() as any).currency ?? DEFAULT_CURRENCY);
    const salaryCurrency = formatCurrencyCode(salary.currency ?? accountCurrency);
    const originalAmount = salary.amount as number;
    const depositMode =
      salary.depositMode === "keep_salary_currency"
        ? "keep_salary_currency"
        : "convert_to_account_currency";
    let grossAmount = originalAmount;
    let fxRate: number | null = null;
    if (depositMode === "keep_salary_currency" && salaryCurrency !== accountCurrency) {
      throw new Error(`To keep salary in ${salaryCurrency}, choose a ${salaryCurrency} account.`);
    }
    if (depositMode === "convert_to_account_currency" && salaryCurrency !== accountCurrency) {
      fxRate = await fetchFxRate(salaryCurrency, accountCurrency);
      grossAmount = round2(originalAmount * fxRate);
    }

    const storedTaxRate =
      typeof salary.taxRate === "number" ? clampTaxRate(salary.taxRate) : 0;
    const estimatedAmount = round2(grossAmount * (1 - storedTaxRate));
    const amount = typeof receivedAmount === "number" && receivedAmount > 0 ? receivedAmount : estimatedAmount;

    // Recalibrate the tax rate from the actual amount received so next month's estimate improves.
    const appliedTaxRate =
      typeof receivedAmount === "number" && receivedAmount > 0 && grossAmount > 0
        ? clampTaxRate(1 - receivedAmount / grossAmount)
        : storedTaxRate;

    const prev = aSnap.data().balance as number;
    const txId = newId();
    const tRef = transactionDoc(uid, txId);
    const occurredAt = Timestamp.fromDate(occurredAtDate);

    trx.set(tRef, {
      schemaVersion: 1,
      id: txId,
      kind: "income",
      status: "active",
      amount,
      currency: accountCurrency,
      accountId,
      categoryId: salary.categoryId,
      occurredAt,
      note: fxRate
        ? `Salary: ${salary.employerName ?? "Paycheck"} (${formatCurrencyCode(salaryCurrency)} ${originalAmount} at ${fxRate.toFixed(4)}${appliedTaxRate > 0 ? `, ${(appliedTaxRate * 100).toFixed(2)}% withheld` : ""})`
        : `Salary: ${salary.employerName ?? "Paycheck"}`,
      salaryProfileId,
      salaryGrossAmount: grossAmount,
      salaryTaxRate: appliedTaxRate,
      ...(fxRate
        ? {
            fxOriginalAmount: originalAmount,
            fxOriginalCurrency: salaryCurrency,
            fxRate,
          }
        : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    trx.update(aRef, {
      balance: prev + amount,
      updatedAt: serverTimestamp(),
      balanceMutationId: txId,
    });

    const currentNextPayday =
      salary.nextPaydayAt instanceof Timestamp ? salary.nextPaydayAt.toDate() : occurredAtDate;

    trx.update(sRef, {
      taxRate: appliedTaxRate,
      lastPaidAt: serverTimestamp(),
      nextPaydayAt: Timestamp.fromDate(nextMonthlyPayday(currentNextPayday, occurredAtDate)),
      updatedAt: serverTimestamp(),
    });
  });
}
