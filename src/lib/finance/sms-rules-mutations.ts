import { runTransaction, serverTimestamp } from "firebase/firestore";
import { z } from "zod";
import { getFirebaseDb } from "@/lib/firebase/client";
import { accountDoc, smsRuleDoc } from "@/lib/firestore/refs";
import { newId } from "@/shared/ids";

const smsRuleInputSchema = z.object({
  label: z.string().min(1).max(64),
  senderMatch: z.string().min(1).max(32),
  accountId: z.string().min(1),
  kind: z.enum(["income", "expense"]),
  pattern: z.string().min(1).max(500),
  noteTemplate: z.string().max(200).optional(),
});

const updateSmsRuleInputSchema = smsRuleInputSchema.extend({
  ruleId: z.string().min(1),
  enabled: z.boolean(),
});

export async function createSmsRule(
  uid: string,
  input: z.infer<typeof smsRuleInputSchema>,
) {
  const values = smsRuleInputSchema.parse(input);
  const db = getFirebaseDb();
  const id = newId();
  const ref = smsRuleDoc(uid, id);

  await runTransaction(db, async (tx) => {
    const aSnap = await tx.get(accountDoc(uid, values.accountId));
    if (!aSnap.exists()) throw new Error("Account not found");

    tx.set(ref, {
      schemaVersion: 1,
      id,
      label: values.label,
      senderMatch: values.senderMatch,
      accountId: values.accountId,
      kind: values.kind,
      pattern: values.pattern,
      ...(values.noteTemplate ? { noteTemplate: values.noteTemplate } : {}),
      enabled: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return id;
}

export async function updateSmsRule(
  uid: string,
  input: z.infer<typeof updateSmsRuleInputSchema>,
) {
  const values = updateSmsRuleInputSchema.parse(input);
  const db = getFirebaseDb();
  const ref = smsRuleDoc(uid, values.ruleId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Rule not found");
    const aSnap = await tx.get(accountDoc(uid, values.accountId));
    if (!aSnap.exists()) throw new Error("Account not found");

    tx.update(ref, {
      label: values.label,
      senderMatch: values.senderMatch,
      accountId: values.accountId,
      kind: values.kind,
      pattern: values.pattern,
      noteTemplate: values.noteTemplate ?? "",
      enabled: values.enabled,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function setSmsRuleEnabled(uid: string, ruleId: string, enabled: boolean) {
  const db = getFirebaseDb();
  const ref = smsRuleDoc(uid, ruleId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Rule not found");
    tx.update(ref, { enabled, updatedAt: serverTimestamp() });
  });
}

export async function deleteSmsRule(uid: string, ruleId: string) {
  const db = getFirebaseDb();
  const ref = smsRuleDoc(uid, ruleId);

  await runTransaction(db, async (tx) => {
    tx.delete(ref);
  });
}
