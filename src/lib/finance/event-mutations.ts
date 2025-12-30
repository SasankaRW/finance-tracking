import { Timestamp, deleteField, runTransaction, serverTimestamp } from "firebase/firestore";
import { z } from "zod";
import { getFirebaseDb } from "@/lib/firebase/client";
import { eventDoc } from "@/lib/firestore/refs";
import { DEFAULT_CURRENCY } from "@/shared/currency";
import { newId } from "@/shared/ids";

const createEventInputSchema = z
  .object({
    name: z.string().min(1).max(64),
    currency: z.string().min(3).max(3).default(DEFAULT_CURRENCY),
    budgetMin: z.number().finite().min(0).default(0),
    budgetMax: z.number().finite().min(0),
    startAt: z.date().optional(),
    endAt: z.date().optional(),
    defaultAccountId: z.string().min(1).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.budgetMax < v.budgetMin) {
      ctx.addIssue({
        code: "custom",
        path: ["budgetMax"],
        message: "budgetMax must be >= budgetMin",
      });
    }
    if (v.startAt && v.endAt && v.endAt < v.startAt) {
      ctx.addIssue({
        code: "custom",
        path: ["endAt"],
        message: "endAt must be >= startAt",
      });
    }
  });

export async function createEvent(uid: string, input: z.infer<typeof createEventInputSchema>) {
  const values = createEventInputSchema.parse(input);
  const db = getFirebaseDb();
  const id = newId();
  const ref = eventDoc(uid, id);

  await runTransaction(db, async (tx) => {
    tx.set(ref, {
      schemaVersion: 1,
      id,
      status: "active",
      name: values.name,
      currency: values.currency.toUpperCase(),
      budgetMin: values.budgetMin,
      budgetMax: values.budgetMax,
      ...(values.startAt ? { startAt: Timestamp.fromDate(values.startAt) } : {}),
      ...(values.endAt ? { endAt: Timestamp.fromDate(values.endAt) } : {}),
      ...(values.defaultAccountId ? { defaultAccountId: values.defaultAccountId } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return id;
}

const updateEventInputSchema = z
  .object({
    eventId: z.string().min(1),
    name: z.string().min(1).max(64).optional(),
    status: z.enum(["active", "archived"]).optional(),
    budgetMin: z.number().finite().min(0).optional(),
    budgetMax: z.number().finite().min(0).optional(),
    startAt: z.date().nullable().optional(),
    endAt: z.date().nullable().optional(),
    defaultAccountId: z.string().min(1).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.budgetMin !== undefined && v.budgetMax !== undefined && v.budgetMax < v.budgetMin) {
      ctx.addIssue({ code: "custom", path: ["budgetMax"], message: "budgetMax must be >= budgetMin" });
    }
  });

export async function updateEvent(uid: string, input: z.infer<typeof updateEventInputSchema>) {
  const values = updateEventInputSchema.parse(input);
  const db = getFirebaseDb();
  const ref = eventDoc(uid, values.eventId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Event not found");
    const prev = snap.data() as any;
    const nextBudgetMin = values.budgetMin ?? prev.budgetMin ?? 0;
    const nextBudgetMax = values.budgetMax ?? prev.budgetMax ?? 0;
    if (nextBudgetMax < nextBudgetMin) {
      throw new Error("budgetMax must be >= budgetMin");
    }

    tx.update(ref, {
      ...(values.name ? { name: values.name } : {}),
      ...(values.status ? { status: values.status } : {}),
      ...(values.budgetMin !== undefined ? { budgetMin: values.budgetMin } : {}),
      ...(values.budgetMax !== undefined ? { budgetMax: values.budgetMax } : {}),
      ...(values.startAt === undefined
        ? {}
        : values.startAt
          ? { startAt: Timestamp.fromDate(values.startAt) }
          : { startAt: deleteField() }),
      ...(values.endAt === undefined
        ? {}
        : values.endAt
          ? { endAt: Timestamp.fromDate(values.endAt) }
          : { endAt: deleteField() }),
      ...(values.defaultAccountId === undefined
        ? {}
        : values.defaultAccountId
          ? { defaultAccountId: values.defaultAccountId }
          : { defaultAccountId: deleteField() }),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function deleteEvent(uid: string, eventId: string) {
  const db = getFirebaseDb();
  const ref = eventDoc(uid, eventId);
  await runTransaction(db, async (tx) => {
    tx.delete(ref);
  });
}



