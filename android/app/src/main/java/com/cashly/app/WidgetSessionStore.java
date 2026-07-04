package com.cashly.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.ArrayList;
import java.util.List;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public class WidgetSessionStore {
    private static final String PREFS = "cashly_widget_session";
    private static final String SESSION = "session";
    private static final String LAST_ACCOUNT_ID = "lastAccountId";
    private static final String LAST_FROM_ACCOUNT_ID = "lastFromAccountId";
    private static final String LAST_TO_ACCOUNT_ID = "lastToAccountId";
    private static final String LAST_EXPENSE_CATEGORY_ID = "lastExpenseCategoryId";
    private static final String LAST_INCOME_CATEGORY_ID = "lastIncomeCategoryId";
    private static final String KEY_ALIAS = "cashly_widget_session_key";
    private static final int GCM_TAG_BITS = 128;

    private final Context context;

    public WidgetSessionStore(Context context) {
        this.context = context.getApplicationContext();
    }

    public void save(WidgetSession session) throws Exception {
        JSONObject json = new JSONObject();
        json.put("uid", session.uid);
        json.put("idToken", session.idToken);
        json.put("expiresAt", session.expiresAt);
        json.put("projectId", session.projectId);
        json.put("accounts", itemsToJson(session.accounts, true));
        json.put("categories", itemsToJson(session.categories, false));

        prefs().edit().putString(SESSION, encrypt(json.toString())).apply();
    }

    public WidgetSession read() throws Exception {
        String encrypted = prefs().getString(SESSION, null);
        if (encrypted == null || encrypted.isEmpty()) return null;

        JSONObject json = new JSONObject(decrypt(encrypted));
        WidgetSession session = new WidgetSession();
        session.uid = json.optString("uid", "");
        session.idToken = json.optString("idToken", "");
        session.expiresAt = json.optLong("expiresAt", 0);
        session.projectId = json.optString("projectId", "");
        session.accounts = itemsFromJson(json.optJSONArray("accounts"));
        session.categories = itemsFromJson(json.optJSONArray("categories"));
        return session;
    }

    public void clear() {
        prefs().edit().remove(SESSION).apply();
    }

    public boolean hasFreshSession() {
        try {
            WidgetSession session = read();
            return session != null && session.isFresh();
        } catch (Exception e) {
            return false;
        }
    }

    public String getLast(String key) {
        return prefs().getString(key, "");
    }

    public void rememberQuickAddDefaults(String kind, String accountId, String fromAccountId, String toAccountId, String categoryId) {
        SharedPreferences.Editor editor = prefs().edit();
        if (accountId != null && !accountId.isEmpty()) editor.putString(LAST_ACCOUNT_ID, accountId);
        if (fromAccountId != null && !fromAccountId.isEmpty()) editor.putString(LAST_FROM_ACCOUNT_ID, fromAccountId);
        if (toAccountId != null && !toAccountId.isEmpty()) editor.putString(LAST_TO_ACCOUNT_ID, toAccountId);
        if ("income".equals(kind) && categoryId != null && !categoryId.isEmpty()) {
            editor.putString(LAST_INCOME_CATEGORY_ID, categoryId);
        } else if ("expense".equals(kind) && categoryId != null && !categoryId.isEmpty()) {
            editor.putString(LAST_EXPENSE_CATEGORY_ID, categoryId);
        }
        editor.apply();
    }

    public String lastAccountId() {
        return getLast(LAST_ACCOUNT_ID);
    }

    public String lastFromAccountId() {
        return getLast(LAST_FROM_ACCOUNT_ID);
    }

    public String lastToAccountId() {
        return getLast(LAST_TO_ACCOUNT_ID);
    }

    public String lastCategoryId(String kind) {
        return getLast("income".equals(kind) ? LAST_INCOME_CATEGORY_ID : LAST_EXPENSE_CATEGORY_ID);
    }

    private JSONArray itemsToJson(List<WidgetItem> items, boolean includeCurrency) throws JSONException {
        JSONArray array = new JSONArray();
        for (WidgetItem item : items) {
            JSONObject json = new JSONObject();
            json.put("id", item.id);
            json.put("name", item.name);
            json.put("kind", item.kind);
            if (includeCurrency) json.put("currency", item.currency);
            array.put(json);
        }
        return array;
    }

    private List<WidgetItem> itemsFromJson(JSONArray array) {
        List<WidgetItem> items = new ArrayList<>();
        if (array == null) return items;

        for (int i = 0; i < array.length(); i++) {
            JSONObject json = array.optJSONObject(i);
            if (json == null) continue;
            items.add(new WidgetItem(
                json.optString("id", ""),
                json.optString("name", ""),
                json.optString("kind", ""),
                json.optString("currency", "USD")
            ));
        }
        return items;
    }

    private SharedPreferences prefs() {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private String encrypt(String plainText) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
        byte[] iv = cipher.getIV();
        byte[] encrypted = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));

        JSONObject envelope = new JSONObject();
        envelope.put("iv", Base64.encodeToString(iv, Base64.NO_WRAP));
        envelope.put("data", Base64.encodeToString(encrypted, Base64.NO_WRAP));
        return envelope.toString();
    }

    private String decrypt(String encryptedText) throws Exception {
        JSONObject envelope = new JSONObject(encryptedText);
        byte[] iv = Base64.decode(envelope.getString("iv"), Base64.NO_WRAP);
        byte[] data = Base64.decode(envelope.getString("data"), Base64.NO_WRAP);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(GCM_TAG_BITS, iv));
        return new String(cipher.doFinal(data), StandardCharsets.UTF_8);
    }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) {
            return ((KeyStore.SecretKeyEntry) keyStore.getEntry(KEY_ALIAS, null)).getSecretKey();
        }

        KeyGenerator keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .build();
        keyGenerator.init(spec);
        return keyGenerator.generateKey();
    }

    public static class WidgetSession {
        public String uid;
        public String idToken;
        public long expiresAt;
        public String projectId;
        public List<WidgetItem> accounts = new ArrayList<>();
        public List<WidgetItem> categories = new ArrayList<>();

        public boolean isFresh() {
            return uid != null && !uid.isEmpty()
                && idToken != null && !idToken.isEmpty()
                && projectId != null && !projectId.isEmpty()
                && expiresAt > System.currentTimeMillis() + 60_000;
        }
    }

    public static class WidgetItem {
        public final String id;
        public final String name;
        public final String kind;
        public final String currency;

        public WidgetItem(String id, String name, String kind, String currency) {
            this.id = id;
            this.name = name;
            this.kind = kind;
            this.currency = currency == null || currency.isEmpty() ? "USD" : currency;
        }

        @Override
        public String toString() {
            return name == null || name.isEmpty() ? id : name;
        }
    }
}
