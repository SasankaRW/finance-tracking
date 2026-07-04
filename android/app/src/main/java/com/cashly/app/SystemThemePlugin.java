package com.cashly.app;

import android.app.Activity;
import android.content.Context;
import android.util.TypedValue;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SystemTheme")
public class SystemThemePlugin extends Plugin {

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void getAccentColor(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }

        int color = resolveThemeColor(activity, com.google.android.material.R.attr.colorPrimary);
        if (color == 0) {
            color = resolveThemeColor(activity, androidx.appcompat.R.attr.colorPrimary);
        }
        if (color == 0) {
            color = resolveThemeColor(activity, android.R.attr.colorAccent);
        }
        if (color == 0) {
            call.reject("Unable to resolve system accent color");
            return;
        }

        String hex = String.format("#%06X", (0xFFFFFF & color));
        JSObject ret = new JSObject();
        ret.put("hex", hex);
        call.resolve(ret);
    }

    private int resolveThemeColor(Context context, int attr) {
        TypedValue typedValue = new TypedValue();
        if (!context.getTheme().resolveAttribute(attr, typedValue, true)) {
            return 0;
        }

        if (typedValue.type >= TypedValue.TYPE_FIRST_COLOR_INT
                && typedValue.type <= TypedValue.TYPE_LAST_COLOR_INT) {
            return typedValue.data;
        }

        if (typedValue.resourceId != 0) {
            return ContextCompat.getColor(context, typedValue.resourceId);
        }

        return 0;
    }
}
