import { collection, doc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";

export function userDoc(uid: string) {
  return doc(getFirebaseDb(), "users", uid);
}

export function profileDoc(uid: string) {
  return doc(getFirebaseDb(), "users", uid, "profile", "profile");
}

export function accountsCol(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "accounts");
}

export function accountDoc(uid: string, accountId: string) {
  return doc(getFirebaseDb(), "users", uid, "accounts", accountId);
}

export function categoriesCol(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "categories");
}

export function categoryDoc(uid: string, categoryId: string) {
  return doc(getFirebaseDb(), "users", uid, "categories", categoryId);
}

export function transactionsCol(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "transactions");
}

export function transactionDoc(uid: string, transactionId: string) {
  return doc(getFirebaseDb(), "users", uid, "transactions", transactionId);
}

export function budgetsCol(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "budgets");
}

export function budgetDoc(uid: string, budgetId: string) {
  return doc(getFirebaseDb(), "users", uid, "budgets", budgetId);
}

export function subscriptionsCol(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "subscriptions");
}

export function subscriptionDoc(uid: string, subscriptionId: string) {
  return doc(getFirebaseDb(), "users", uid, "subscriptions", subscriptionId);
}

export function eventsCol(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "events");
}

export function eventDoc(uid: string, eventId: string) {
  return doc(getFirebaseDb(), "users", uid, "events", eventId);
}


