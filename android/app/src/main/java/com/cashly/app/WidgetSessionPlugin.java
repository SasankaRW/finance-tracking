package com.cashly.app;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "WidgetSession")
public class WidgetSessionPlugin extends Plugin {

    @PluginMethod
    public void sync(PluginCall call) {
        String uid = call.getString("uid", "");
        String idToken = call.getString("idToken", "");
        String projectId = call.getString("projectId", BuildConfig.FIREBASE_PROJECT_ID);
        Long expiresAt = call.getLong("expiresAt");

        if (uid.isEmpty() || idToken.isEmpty() || projectId.isEmpty() || expiresAt == null) {
            call.reject("Missing widget session data");
            return;
        }

        try {
            WidgetSessionStore.WidgetSession session = new WidgetSessionStore.WidgetSession();
            session.uid = uid;
            session.idToken = idToken;
            session.projectId = projectId;
            session.expiresAt = expiresAt;
            session.accounts = parseItems(call.getArray("accounts"), true);
            session.categories = parseItems(call.getArray("categories"), false);

            new WidgetSessionStore(getContext()).save(session);

            JSObject ret = new JSObject();
            ret.put("saved", true);
            ret.put("accountCount", session.accounts.size());
            ret.put("categoryCount", session.categories.size());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to save widget session", e);
        }
    }

    @PluginMethod
    public void clear(PluginCall call) {
        new WidgetSessionStore(getContext()).clear();
        JSObject ret = new JSObject();
        ret.put("cleared", true);
        call.resolve(ret);
    }

    private List<WidgetSessionStore.WidgetItem> parseItems(JSArray array, boolean includeCurrency) {
        List<WidgetSessionStore.WidgetItem> items = new ArrayList<>();
        if (array == null) return items;

        for (int i = 0; i < array.length(); i++) {
            JSONObject json = array.optJSONObject(i);
            if (json == null) continue;
            String id = json.optString("id", "");
            String name = json.optString("name", "");
            String kind = json.optString("kind", "");
            String currency = includeCurrency ? json.optString("currency", "USD") : "";
            if (!id.isEmpty() && !name.isEmpty()) {
                items.add(new WidgetSessionStore.WidgetItem(id, name, kind, currency));
            }
        }
        return items;
    }
}
