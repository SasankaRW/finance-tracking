package com.cashly.app;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;

public class FirestoreWidgetTransactionClient {
    private static final String DATABASE_ID = "(default)";

    private final WidgetSessionStore.WidgetSession session;

    public FirestoreWidgetTransactionClient(WidgetSessionStore.WidgetSession session) {
        this.session = session;
    }

    public String createTransaction(QuickAddInput input) throws Exception {
        if (!session.isFresh()) {
            throw new IllegalStateException("Open Cashly once to refresh widget access.");
        }

        String txId = UUID.randomUUID().toString();
        String transaction = beginTransaction();
        try {
            if ("transfer".equals(input.kind)) {
                createTransfer(input, txId, transaction);
            } else {
                createIncomeOrExpense(input, txId, transaction);
            }
            return txId;
        } catch (Exception e) {
            rollback(transaction);
            throw e;
        }
    }

    private void createIncomeOrExpense(QuickAddInput input, String txId, String transaction) throws Exception {
        FirestoreAccount account = readAccount(input.accountId, transaction);
        if (account == null) throw new IllegalStateException("Account not found");

        double nextBalance = "income".equals(input.kind)
            ? account.balance + input.amount
            : account.balance - input.amount;

        JSONArray writes = new JSONArray();
        writes.put(transactionCreateWrite(txId, input, account.currency, null, null));
        writes.put(accountBalanceWrite(input.accountId, nextBalance, txId));
        commit(transaction, writes);
    }

    private void createTransfer(QuickAddInput input, String txId, String transaction) throws Exception {
        FirestoreAccount from = readAccount(input.fromAccountId, transaction);
        FirestoreAccount to = readAccount(input.toAccountId, transaction);
        if (from == null || to == null) throw new IllegalStateException("Account not found");
        if (!from.currency.equalsIgnoreCase(to.currency)) {
            throw new IllegalStateException(
                "Cross-currency transfers are not supported yet (" + from.currency + " to " + to.currency + ")."
            );
        }

        JSONArray writes = new JSONArray();
        writes.put(transactionCreateWrite(txId, input, from.currency, from.currency, to.currency));
        writes.put(accountBalanceWrite(input.fromAccountId, from.balance - input.amount, txId));
        writes.put(accountBalanceWrite(input.toAccountId, to.balance + input.amount, txId));
        commit(transaction, writes);
    }

    private String beginTransaction() throws Exception {
        JSONObject response = requestJson("POST", baseUrl() + ":beginTransaction", new JSONObject());
        return response.optString("transaction", "");
    }

    private void rollback(String transaction) {
        if (transaction == null || transaction.isEmpty()) return;
        try {
            JSONObject body = new JSONObject();
            body.put("transaction", transaction);
            requestJson("POST", baseUrl() + ":rollback", body);
        } catch (Exception ignored) {
            // Best-effort cleanup only.
        }
    }

    private FirestoreAccount readAccount(String accountId, String transaction) throws Exception {
        String name = documentName("users/" + session.uid + "/accounts/" + accountId);
        JSONObject body = new JSONObject();
        JSONArray documents = new JSONArray();
        documents.put(name);
        body.put("documents", documents);
        body.put("transaction", transaction);

        String response = request("POST", baseUrl() + ":batchGet", body.toString());
        JSONArray rows = parseBatchGetResponse(response);
        for (int i = 0; i < rows.length(); i++) {
            JSONObject found = rows.optJSONObject(i) != null ? rows.optJSONObject(i).optJSONObject("found") : null;
            if (found == null) continue;
            JSONObject fields = found.optJSONObject("fields");
            if (fields == null) continue;
            double balance = numberValue(fields.optJSONObject("balance"));
            String currency = stringValue(fields.optJSONObject("currency"), "USD").toUpperCase(Locale.ROOT);
            return new FirestoreAccount(balance, currency);
        }
        return null;
    }

    private JSONArray parseBatchGetResponse(String response) throws Exception {
        String trimmed = response.trim();
        if (trimmed.startsWith("[")) return new JSONArray(trimmed);

        JSONArray rows = new JSONArray();
        BufferedReader reader = new BufferedReader(new InputStreamReader(
            new java.io.ByteArrayInputStream(trimmed.getBytes(StandardCharsets.UTF_8)),
            StandardCharsets.UTF_8
        ));
        String line;
        while ((line = reader.readLine()) != null) {
            String value = line.trim();
            if (value.startsWith("{")) rows.put(new JSONObject(value));
        }
        if (rows.length() == 0 && trimmed.startsWith("{")) rows.put(new JSONObject(trimmed));
        return rows;
    }

    private JSONObject transactionCreateWrite(
        String txId,
        QuickAddInput input,
        String currency,
        String fromCurrency,
        String toCurrency
    ) throws Exception {
        JSONObject fields = new JSONObject();
        putInt(fields, "schemaVersion", 1);
        putString(fields, "id", txId);
        putString(fields, "kind", input.kind);
        putString(fields, "status", "active");
        putNumber(fields, "amount", input.amount);
        putString(fields, "currency", currency);

        if ("transfer".equals(input.kind)) {
            putString(fields, "fromAccountId", input.fromAccountId);
            putString(fields, "toAccountId", input.toAccountId);
            putString(fields, "fromCurrency", fromCurrency);
            putString(fields, "toCurrency", toCurrency);
        } else {
            putString(fields, "accountId", input.accountId);
            putString(fields, "categoryId", input.categoryId);
        }

        String now = nowTimestamp();
        putTimestamp(fields, "occurredAt", now);
        if (input.note != null && !input.note.trim().isEmpty()) {
            putString(fields, "note", input.note.trim());
        }
        putTimestamp(fields, "createdAt", now);
        putTimestamp(fields, "updatedAt", now);

        JSONObject update = new JSONObject();
        update.put("name", documentName("users/" + session.uid + "/transactions/" + txId));
        update.put("fields", fields);

        JSONObject write = new JSONObject();
        write.put("update", update);
        return write;
    }

    private JSONObject accountBalanceWrite(String accountId, double balance, String txId) throws Exception {
        JSONObject fields = new JSONObject();
        putNumber(fields, "balance", balance);
        putTimestamp(fields, "updatedAt", nowTimestamp());
        putString(fields, "balanceMutationId", txId);

        JSONObject update = new JSONObject();
        update.put("name", documentName("users/" + session.uid + "/accounts/" + accountId));
        update.put("fields", fields);

        JSONObject mask = new JSONObject();
        JSONArray paths = new JSONArray();
        paths.put("balance");
        paths.put("updatedAt");
        paths.put("balanceMutationId");
        mask.put("fieldPaths", paths);

        JSONObject write = new JSONObject();
        write.put("update", update);
        write.put("updateMask", mask);
        return write;
    }

    private void commit(String transaction, JSONArray writes) throws Exception {
        JSONObject body = new JSONObject();
        body.put("transaction", transaction);
        body.put("writes", writes);
        requestJson("POST", baseUrl() + ":commit", body);
    }

    private JSONObject requestJson(String method, String url, JSONObject body) throws Exception {
        String response = request(method, url, body.toString());
        return response.isEmpty() ? new JSONObject() : new JSONObject(response);
    }

    private String request(String method, String urlString, String body) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(urlString).openConnection();
        connection.setRequestMethod(method);
        connection.setRequestProperty("Authorization", "Bearer " + session.idToken);
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        connection.setRequestProperty("Accept", "application/json");
        connection.setConnectTimeout(15_000);
        connection.setReadTimeout(25_000);

        if (body != null) {
            connection.setDoOutput(true);
            try (OutputStream os = connection.getOutputStream()) {
                os.write(body.getBytes(StandardCharsets.UTF_8));
            }
        }

        int code = connection.getResponseCode();
        String response = readStream(code >= 200 && code < 300 ? connection.getInputStream() : connection.getErrorStream());
        if (code < 200 || code >= 300) {
            throw new IllegalStateException(errorMessage(response, code));
        }
        return response;
    }

    private String readStream(InputStream inputStream) throws Exception {
        if (inputStream == null) return "";
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            StringBuilder builder = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                builder.append(line).append('\n');
            }
            return builder.toString();
        }
    }

    private String errorMessage(String response, int code) {
        try {
            JSONObject json = new JSONObject(response);
            JSONObject error = json.optJSONObject("error");
            if (error != null) {
                return error.optString("message", "Firestore request failed (" + code + ")");
            }
        } catch (Exception ignored) {
            // Fall back below.
        }
        return "Firestore request failed (" + code + ")";
    }

    private String baseUrl() {
        return "https://firestore.googleapis.com/v1/projects/"
            + session.projectId
            + "/databases/"
            + DATABASE_ID
            + "/documents";
    }

    private String documentName(String relativePath) {
        return "projects/" + session.projectId + "/databases/" + DATABASE_ID + "/documents/" + relativePath;
    }

    private String nowTimestamp() {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date());
    }

    private void putString(JSONObject fields, String key, String value) throws Exception {
        if (value == null || value.isEmpty()) return;
        JSONObject field = new JSONObject();
        field.put("stringValue", value);
        fields.put(key, field);
    }

    private void putInt(JSONObject fields, String key, int value) throws Exception {
        JSONObject field = new JSONObject();
        field.put("integerValue", String.valueOf(value));
        fields.put(key, field);
    }

    private void putNumber(JSONObject fields, String key, double value) throws Exception {
        JSONObject field = new JSONObject();
        field.put("doubleValue", value);
        fields.put(key, field);
    }

    private void putTimestamp(JSONObject fields, String key, String value) throws Exception {
        JSONObject field = new JSONObject();
        field.put("timestampValue", value);
        fields.put(key, field);
    }

    private String stringValue(JSONObject field, String fallback) {
        if (field == null) return fallback;
        return field.optString("stringValue", fallback);
    }

    private double numberValue(JSONObject field) {
        if (field == null) return 0;
        if (field.has("doubleValue")) return field.optDouble("doubleValue", 0);
        if (field.has("integerValue")) return field.optDouble("integerValue", 0);
        return 0;
    }

    private static class FirestoreAccount {
        final double balance;
        final String currency;

        FirestoreAccount(double balance, String currency) {
            this.balance = balance;
            this.currency = currency == null || currency.isEmpty() ? "USD" : currency;
        }
    }

    public static class QuickAddInput {
        public String kind;
        public double amount;
        public String accountId;
        public String categoryId;
        public String fromAccountId;
        public String toAccountId;
        public String note;

        public List<String> validate() {
            List<String> errors = new ArrayList<>();
            if (!"expense".equals(kind) && !"income".equals(kind) && !"transfer".equals(kind)) {
                errors.add("Choose a transaction type.");
            }
            if (amount <= 0 || Double.isNaN(amount) || Double.isInfinite(amount)) {
                errors.add("Enter an amount greater than zero.");
            }
            if ("transfer".equals(kind)) {
                if (fromAccountId == null || fromAccountId.isEmpty()) errors.add("Choose a from account.");
                if (toAccountId == null || toAccountId.isEmpty()) errors.add("Choose a to account.");
                if (fromAccountId != null && fromAccountId.equals(toAccountId)) {
                    errors.add("Transfer accounts must be different.");
                }
            } else {
                if (accountId == null || accountId.isEmpty()) errors.add("Choose an account.");
                if (categoryId == null || categoryId.isEmpty()) errors.add("Choose a category.");
            }
            return errors;
        }
    }
}
