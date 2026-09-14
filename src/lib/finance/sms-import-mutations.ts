import { Timestamp, getDoc, getDocs, runTransaction, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { z } from "zod";
import { getFirebaseDb } from "@/lib/firebase/client";
import { accountDoc, pendingImportDoc, smsRulesCol, transactionDoc } from "@/lib/firestore/refs";
import { applyNoteTemplate, matchMessageAgainstRules, resolveOccurredAt } from "@/lib/finance/sms-parser";
import type { SmsRuleDoc } from "@/shared/finance-schemas";
import { newId } from "@/shared/ids";

const ingestInputSchema = z.object({
  sender: z.string().max(64).optional(),
  body: z.string().min(1).max(2000),
  receivedAt: z.date(),
});

// Parses a raw SMS/pasted message against the user's current rules and writes
// a pendingImports doc. Used by both the native-queue drain (which passes a
// stable per-message `id` so re-processing after a crash upserts instead of
// duplicating) and the manual "paste a message" path (no `id`, mints a fresh one).
export async function ingestRawMessage(
  uid: string,
  input: z.infer<typeof ingestInputSchema>,
  options: { id?: string } = {},
) {
  const values = ingestInputSchema.parse(input);

  const rulesSnap = await getDocs(smsRulesCol(uid));
  const rules = rulesSnap.docs.map((d) => d.data() as SmsRuleDoc);
  const matched = matchMessageAgainstRules(rules, values.sender, values.body);

  const id = options.id ?? newId();
  const ref = pendingImportDoc(uid, id);
  const occurredAt = matched
    ? (resolveOccurredAt(matched.fields, values.receivedAt) ?? values.receivedAt)
    : null;

  await setDoc(ref, {
    schemaVersion: 1,
    id,
    status: "pending",
    rawMessage: values.body,
    ...(values.sender ? { sender: values.sender } : {}),
    receivedAt: Timestamp.fromDate(values.receivedAt),
    ...(matched
      ? {
          matchedRuleId: matched.rule.id,
          accountId: matched.rule.accountId,
          kind: matched.rule.kind,
          ...(matched.rule.kind === "transfer" ? { toAccountId: matched.rule.toAccountId } : {}),
          amount: matched.fields.amount,
          occurredAt: Timestamp.fromDate(occurredAt ?? values.receivedAt),
          suggestedNote: applyNoteTemplate(matched.rule.noteTemplate, matched.fields, values.body),
        }
      : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return id;
}

// Re-tries matching a message that came in before its rule existed (or before
// the rule's pattern was corrected) against the user's *current* rules,
// without waiting for a duplicate SMS to arrive. Only touches messages still
// pending and still unmatched, so it can't clobber an already-reviewed item
// or a match a human already fixed up by hand.
export async function retryMatchPendingImport(uid: string, pendingImportId: string) {
  const ref = pendingImportDoc(uid, pendingImportId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Message not found");
  const data = snap.data() as any;
  if (data.status !== "pending") throw new Error("This message has already been reviewed");
  if (data.accountId) return false; // already matched

  const rulesSnap = await getDocs(smsRulesCol(uid));
  const rules = rulesSnap.docs.map((d) => d.data() as SmsRuleDoc);
  const receivedAt = (data.receivedAt as Timestamp).toDate();
  const matched = matchMessageAgainstRules(rules, data.sender, data.rawMessage);
  if (!matched) return false;

  const occurredAt = resolveOccurredAt(matched.fields, receivedAt) ?? receivedAt;
  await updateDoc(ref, {
    matchedRuleId: matched.rule.id,
    accountId: matched.rule.accountId,
    kind: matched.rule.kind,
    ...(matched.rule.kind === "transfer" ? { toAccountId: matched.rule.toAccountId } : {}),
    amount: matched.fields.amount,
    occurredAt: Timestamp.fromDate(occurredAt),
    suggestedNote: applyNoteTemplate(matched.rule.noteTemplate, matched.fields, data.rawMessage),
    updatedAt: serverTimestamp(),
  });
  return true;
}

const approveInputSchema = z.object({
  kind: z.enum(["income", "expense"]),
  amount: z.number().positive().finite(),
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  occurredAt: z.date(),
  note: z.string().max(280).optional(),
});

// One atomic transaction: reads the account, writes the resulting income/expense
// transaction, updates the account balance, and marks the pendingImports doc
// approved — mirroring recordSubscriptionPayment/recordSalaryPayment rather than
// calling createIncomeOrExpense + a separate status update, so a crash between
// the two writes can't leave a real transaction created while the pending doc
// still reads "pending" (which would let a retry create a duplicate transaction
// and a duplicate balance mutation).
export async function approvePendingImport(
  uid: string,
  pendingImportId: string,
  input: z.infer<typeof approveInputSchema>,
) {
  const values = approveInputSchema.parse(input);
  const db = getFirebaseDb();

  const pRef = pendingImportDoc(uid, pendingImportId);
  const aRef = accountDoc(uid, values.accountId);
  const txId = newId();
  const tRef = transactionDoc(uid, txId);
  const occurredAt = Timestamp.fromDate(values.occurredAt);

  await runTransaction(db, async (trx) => {
    const pSnap = await trx.get(pRef);
    if (!pSnap.exists()) throw new Error("Message not found");
    if ((pSnap.data() as any).status !== "pending") {
      throw new Error("This message has already been reviewed");
    }

    const aSnap = await trx.get(aRef);
    if (!aSnap.exists()) throw new Error("Account not found");

    const currency = ((aSnap.data() as any).currency ?? "USD") as string;
    const prev = aSnap.data().balance as number;
    const next = values.kind === "income" ? prev + values.amount : prev - values.amount;

    trx.set(tRef, {
      schemaVersion: 1,
      id: txId,
      kind: values.kind,
      status: "active",
      amount: values.amount,
      currency,
      accountId: values.accountId,
      categoryId: values.categoryId,
      occurredAt,
      ...(values.note ? { note: values.note } : {}),
      pendingImportId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    trx.update(aRef, {
      balance: next,
      updatedAt: serverTimestamp(),
      balanceMutationId: txId,
    });

    trx.update(pRef, {
      status: "approved",
      resultTransactionId: txId,
      updatedAt: serverTimestamp(),
    });
  });

  return txId;
}

const approveTransferInputSchema = z.object({
  amount: z.number().positive().finite(),
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  occurredAt: z.date(),
  note: z.string().max(280).optional(),
});

// Transfer counterpart to approvePendingImport — same atomic
// read-pending/write-transaction/update-both-balances/mark-approved shape,
// mirroring createTransfer's account bookkeeping (see mutations.ts) rather
// than treating the message as a single-account income/expense.
export async function approvePendingImportAsTransfer(
  uid: string,
  pendingImportId: string,
  input: z.infer<typeof approveTransferInputSchema>,
) {
  const values = approveTransferInputSchema.parse(input);
  if (values.fromAccountId === values.toAccountId) {
    throw new Error("Transfer accounts must be different");
  }

  const db = getFirebaseDb();
  const pRef = pendingImportDoc(uid, pendingImportId);
  const fromRef = accountDoc(uid, values.fromAccountId);
  const toRef = accountDoc(uid, values.toAccountId);
  const txId = newId();
  const tRef = transactionDoc(uid, txId);
  const occurredAt = Timestamp.fromDate(values.occurredAt);

  await runTransaction(db, async (trx) => {
    const pSnap = await trx.get(pRef);
    if (!pSnap.exists()) throw new Error("Message not found");
    if ((pSnap.data() as any).status !== "pending") {
      throw new Error("This message has already been reviewed");
    }

    const fromSnap = await trx.get(fromRef);
    const toSnap = await trx.get(toRef);
    if (!fromSnap.exists() || !toSnap.exists()) throw new Error("Account not found");

    const fromCurrency = ((fromSnap.data() as any).currency ?? "USD") as string;
    const toCurrency = ((toSnap.data() as any).currency ?? "USD") as string;
    if (fromCurrency !== toCurrency) {
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
      pendingImportId,
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

    trx.update(pRef, {
      status: "approved",
      resultTransactionId: txId,
      updatedAt: serverTimestamp(),
    });
  });

  return txId;
}

export async function dismissPendingImport(uid: string, pendingImportId: string) {
  const db = getFirebaseDb();
  const ref = pendingImportDoc(uid, pendingImportId);

  await runTransaction(db, async (trx) => {
    const snap = await trx.get(ref);
    if (!snap.exists()) return;
    if ((snap.data() as any).status !== "pending") return;
    trx.update(ref, { status: "dismissed", updatedAt: serverTimestamp() });
  });
}
