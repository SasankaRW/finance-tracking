"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";
import type { User } from "firebase/auth";
import { getClientEnv } from "@/lib/env";

type WidgetItem = {
  id: string;
  name: string;
  kind?: string;
  currency?: string;
};

type WidgetSessionPlugin = {
  sync(options: {
    uid: string;
    idToken: string;
    expiresAt: number;
    projectId: string;
    accounts: WidgetItem[];
    categories: WidgetItem[];
  }): Promise<{ saved: boolean }>;
  clear(): Promise<{ cleared: boolean }>;
};

const WidgetSession = registerPlugin<WidgetSessionPlugin>("WidgetSession");

export function canSyncWidgetSession() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function syncWidgetSession({
  user,
  accounts,
  categories,
}: {
  user: User;
  accounts: any[];
  categories: any[];
}) {
  if (!canSyncWidgetSession()) return;

  const token = await user.getIdTokenResult();
  const env = getClientEnv();

  await WidgetSession.sync({
    uid: user.uid,
    idToken: token.token,
    expiresAt: new Date(token.expirationTime).getTime(),
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    accounts: accounts
      .filter((account) => account?.id && account?.name)
      .map((account) => ({
        id: account.id,
        name: account.name,
        currency: account.currency ?? "USD",
      })),
    categories: categories
      .filter((category) => category?.id && category?.name && category?.kind)
      .map((category) => ({
        id: category.id,
        name: category.name,
        kind: category.kind,
      })),
  });
}

export async function clearWidgetSession() {
  if (!canSyncWidgetSession()) return;
  await WidgetSession.clear();
}
