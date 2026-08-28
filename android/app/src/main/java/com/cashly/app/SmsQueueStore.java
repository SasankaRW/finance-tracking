package com.cashly.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Local-only queue of raw SMS bodies waiting to be parsed and reviewed in the
 * JS app. Deliberately plaintext (no auth secrets live here, unlike
 * WidgetSessionStore) and never talks to the network — draining/parsing
 * happens in JS once the app is foregrounded and can use the real,
 * already-authenticated Firebase session.
 */
public class SmsQueueStore {
    private static final String PREFS = "cashly_sms_import";
    private static final String SENDERS_KEY = "senders";
    private static final String QUEUE_KEY = "queue";
    private static final int MAX_QUEUE_SIZE = 200;

    private final Context context;

    public SmsQueueStore(Context context) {
        this.context = context.getApplicationContext();
    }

    public boolean matchesConfiguredSender(String address) {
        if (address == null || address.isEmpty()) return false;
        String lowerAddress = address.toLowerCase(Locale.ROOT);
        for (String sender : readSenders()) {
            if (sender != null && !sender.isEmpty() && lowerAddress.contains(sender.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    public List<String> readSenders() {
        List<String> senders = new ArrayList<>();
        try {
            JSONArray array = new JSONArray(prefs().getString(SENDERS_KEY, "[]"));
            for (int i = 0; i < array.length(); i++) {
                senders.add(array.optString(i, ""));
            }
        } catch (Exception ignored) {
            // Corrupt/missing prefs -> treat as no configured senders.
        }
        return senders;
    }

    public void saveSenders(List<String> senders) {
        JSONArray array = new JSONArray();
        for (String sender : senders) {
            if (sender != null && !sender.trim().isEmpty()) array.put(sender.trim());
        }
        prefs().edit().putString(SENDERS_KEY, array.toString()).apply();
    }

    public synchronized void enqueue(String id, String sender, String body, long receivedAtMillis) {
        try {
            JSONArray queue = readQueueRaw();
            JSONObject item = new JSONObject();
            item.put("id", id);
            item.put("sender", sender);
            item.put("body", body);
            item.put("receivedAtMillis", receivedAtMillis);
            queue.put(item);

            while (queue.length() > MAX_QUEUE_SIZE) {
                JSONArray trimmed = new JSONArray();
                for (int i = 1; i < queue.length(); i++) {
                    trimmed.put(queue.get(i));
                }
                queue = trimmed;
            }

            prefs().edit().putString(QUEUE_KEY, queue.toString()).apply();
        } catch (Exception ignored) {
            // Best-effort local cache only; dropping a message here still leaves
            // the manual paste fallback available to the user.
        }
    }

    public synchronized List<QueuedMessage> readQueue() {
        List<QueuedMessage> items = new ArrayList<>();
        JSONArray queue = readQueueRaw();
        for (int i = 0; i < queue.length(); i++) {
            JSONObject item = queue.optJSONObject(i);
            if (item == null) continue;
            String id = item.optString("id", "");
            if (id.isEmpty()) continue;
            items.add(new QueuedMessage(
                id,
                item.optString("sender", ""),
                item.optString("body", ""),
                item.optLong("receivedAtMillis", System.currentTimeMillis())
            ));
        }
        return items;
    }

    public synchronized void ack(List<String> ids) {
        if (ids == null || ids.isEmpty()) return;
        JSONArray queue = readQueueRaw();
        JSONArray remaining = new JSONArray();
        for (int i = 0; i < queue.length(); i++) {
            JSONObject item = queue.optJSONObject(i);
            if (item == null) continue;
            if (!ids.contains(item.optString("id", ""))) remaining.put(item);
        }
        prefs().edit().putString(QUEUE_KEY, remaining.toString()).apply();
    }

    private JSONArray readQueueRaw() {
        try {
            return new JSONArray(prefs().getString(QUEUE_KEY, "[]"));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    private SharedPreferences prefs() {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static class QueuedMessage {
        public final String id;
        public final String sender;
        public final String body;
        public final long receivedAtMillis;

        public QueuedMessage(String id, String sender, String body, long receivedAtMillis) {
            this.id = id;
            this.sender = sender;
            this.body = body;
            this.receivedAtMillis = receivedAtMillis;
        }
    }
}
