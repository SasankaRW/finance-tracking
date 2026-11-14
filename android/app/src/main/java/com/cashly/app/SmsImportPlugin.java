package com.cashly.app;

import android.Manifest;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(
    name = "SmsImport",
    permissions = {
        @Permission(strings = { Manifest.permission.RECEIVE_SMS }, alias = "sms")
    }
)
public class SmsImportPlugin extends Plugin {

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", getPermissionState("sms") == PermissionState.GRANTED);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        requestPermissionForAlias("sms", call, "permissionCallback");
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", getPermissionState("sms") == PermissionState.GRANTED);
        call.resolve(ret);
    }

    @PluginMethod
    public void syncSenders(PluginCall call) {
        new SmsQueueStore(getContext()).saveSenders(stringList(call.getArray("senders")));

        JSObject ret = new JSObject();
        ret.put("saved", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void getQueuedMessages(PluginCall call) {
        List<SmsQueueStore.QueuedMessage> queue = new SmsQueueStore(getContext()).readQueue();
        JSArray messages = new JSArray();
        for (SmsQueueStore.QueuedMessage item : queue) {
            JSObject json = new JSObject();
            json.put("id", item.id);
            json.put("sender", item.sender);
            json.put("body", item.body);
            json.put("receivedAtMillis", item.receivedAtMillis);
            messages.put(json);
        }

        JSObject ret = new JSObject();
        ret.put("messages", messages);
        call.resolve(ret);
    }

    @PluginMethod
    public void ackQueuedMessages(PluginCall call) {
        new SmsQueueStore(getContext()).ack(stringList(call.getArray("ids")));

        JSObject ret = new JSObject();
        ret.put("acked", true);
        call.resolve(ret);
    }

    private List<String> stringList(JSArray array) {
        List<String> values = new ArrayList<>();
        if (array == null) return values;
        try {
            for (int i = 0; i < array.length(); i++) {
                String value = array.getString(i);
                if (value != null) values.add(value);
            }
        } catch (Exception ignored) {
            // Malformed entries are skipped; caller gets whatever parsed cleanly.
        }
        return values;
    }
}
