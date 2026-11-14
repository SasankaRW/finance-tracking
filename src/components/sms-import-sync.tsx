"use client";

import * as React from "react";
import type { User } from "firebase/auth";
import { useSmsRules } from "@/lib/finance/hooks";
import { ingestRawMessage } from "@/lib/finance/sms-import-mutations";
import {
  ackSmsMessages,
  canUseSmsImport,
  drainQueuedSmsMessages,
  syncSmsSenders,
} from "@/lib/sms-import";

// Native-side (SmsReceiver) only ever queues raw text locally — it can't
// parse templates or write to Firestore (see SmsQueueStore). This component
// is the other half: on foreground/resume, push the current rule senders so
// the receiver knows what to keep, drain whatever's queued, parse it against
// the live rules, and write pendingImports docs for review.
export function SmsImportSync({ user }: { user: User }) {
  const { smsRules, loading: rulesLoading } = useSmsRules();

  const drain = React.useCallback(async () => {
    if (!canUseSmsImport()) return;

    const senders = (smsRules as any[])
      .filter((rule) => rule?.enabled)
      .map((rule) => rule.senderMatch)
      .filter((s): s is string => Boolean(s));
    await syncSmsSenders(senders);

    const queued = await drainQueuedSmsMessages();
    if (queued.length === 0) return;

    const ackIds: string[] = [];
    for (const message of queued) {
      try {
        await ingestRawMessage(
          user.uid,
          {
            sender: message.sender || undefined,
            body: message.body,
            receivedAt: new Date(message.receivedAtMillis),
          },
          { id: message.id },
        );
        ackIds.push(message.id);
      } catch (error) {
        // Leave it queued natively; it'll be retried on the next drain.
        console.warn("Failed to ingest queued SMS", error);
      }
    }
    if (ackIds.length > 0) {
      await ackSmsMessages(ackIds);
    }
  }, [smsRules, user]);

  React.useEffect(() => {
    if (rulesLoading || !canUseSmsImport()) return;

    let removed = false;
    void drain().catch((error) => {
      if (removed) return;
      console.warn("SMS import drain failed", error);
    });

    let removeCapListener: (() => void) | undefined;
    void import("@capacitor/app")
      .then(({ App }) => App.addListener("resume", () => void drain()))
      .then((listener) => {
        if (removed) {
          void listener.remove();
          return;
        }
        removeCapListener = () => {
          void listener.remove();
        };
      })
      .catch(() => {
        // @capacitor/app optional on web builds
      });

    return () => {
      removed = true;
      removeCapListener?.();
    };
  }, [rulesLoading, drain]);

  return null;
}
