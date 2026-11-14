"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";

export type QueuedSmsMessage = {
  id: string;
  sender: string;
  body: string;
  receivedAtMillis: number;
};

type SmsImportPlugin = {
  checkPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
  syncSenders(options: { senders: string[] }): Promise<{ saved: boolean }>;
  getQueuedMessages(): Promise<{ messages: QueuedSmsMessage[] }>;
  ackQueuedMessages(options: { ids: string[] }): Promise<{ acked: boolean }>;
};

const SmsImport = registerPlugin<SmsImportPlugin>("SmsImport");

export function canUseSmsImport() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function checkSmsImportPermission() {
  if (!canUseSmsImport()) return false;
  const { granted } = await SmsImport.checkPermission();
  return granted;
}

export async function requestSmsImportPermission() {
  if (!canUseSmsImport()) return false;
  const { granted } = await SmsImport.requestPermission();
  return granted;
}

export async function syncSmsSenders(senders: string[]) {
  if (!canUseSmsImport()) return;
  await SmsImport.syncSenders({ senders });
}

export async function drainQueuedSmsMessages(): Promise<QueuedSmsMessage[]> {
  if (!canUseSmsImport()) return [];
  const { messages } = await SmsImport.getQueuedMessages();
  return messages ?? [];
}

export async function ackSmsMessages(ids: string[]) {
  if (!canUseSmsImport() || ids.length === 0) return;
  await SmsImport.ackQueuedMessages({ ids });
}
