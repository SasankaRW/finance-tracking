package com.cashly.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;

import java.util.UUID;

/**
 * Manifest-registered receiver so bank SMS are captured even when the app
 * process isn't running. Deliberately does nothing beyond a cheap sender
 * filter + local enqueue — no parsing, no network, no Firestore auth (see
 * SmsQueueStore for why).
 */
public class SmsReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;

        SmsMessage[] parts = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        if (parts == null || parts.length == 0) return;

        String address = null;
        StringBuilder body = new StringBuilder();
        for (SmsMessage part : parts) {
            if (part == null) continue;
            if (address == null) address = part.getOriginatingAddress();
            String text = part.getMessageBody();
            if (text != null) body.append(text);
        }
        if (address == null || body.length() == 0) return;

        SmsQueueStore store = new SmsQueueStore(context);
        if (!store.matchesConfiguredSender(address)) return;

        store.enqueue(UUID.randomUUID().toString(), address, body.toString(), System.currentTimeMillis());
    }
}
