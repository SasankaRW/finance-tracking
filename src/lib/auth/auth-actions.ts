"use client";

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { clearSession, createSession } from "@/lib/auth/session-client";
import { ensureDefaultCategoriesSeeded } from "@/lib/finance/seed";
import { clearWidgetSession } from "@/lib/widget-session";

export async function signUpWithEmail(email: string, password: string) {
  const auth = getFirebaseAuth();
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const idToken = await cred.user.getIdToken();
  await createSession(idToken);
  await ensureDefaultCategoriesSeeded(cred.user.uid);
  return cred.user;
}

export async function signInWithEmail(email: string, password: string) {
  const auth = getFirebaseAuth();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const idToken = await cred.user.getIdToken();
  await createSession(idToken);
  await ensureDefaultCategoriesSeeded(cred.user.uid);
  return cred.user;
}

export async function signInWithGoogle() {
  try {
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const cred = await signInWithPopup(auth, provider);
    const idToken = await cred.user.getIdToken();
    await createSession(idToken);
    await ensureDefaultCategoriesSeeded(cred.user.uid);
    return cred.user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
}

export async function resetPassword(email: string) {
  const auth = getFirebaseAuth();
  await sendPasswordResetEmail(auth, email);
}

export async function signOutEverywhere() {
  const auth = getFirebaseAuth();
  await clearWidgetSession();
  await clearSession();
  await signOut(auth);
}


