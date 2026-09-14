package com.cashly.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final String EXTRA_ROUTE = "cashly_route";
    private static final String PENDING_ROUTE_KEY = "cashly:pending-route";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SystemThemePlugin.class);
        registerPlugin(NativeBiometricPlugin.class);
        registerPlugin(WidgetSessionPlugin.class);
        registerPlugin(SmsImportPlugin.class);
        registerPlugin(ScreenSecurityPlugin.class);
        super.onCreate(savedInstanceState);
        openRouteFromIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        openRouteFromIntent(intent);
    }

    private void openRouteFromIntent(Intent intent) {
        if (intent == null) return;

        String route = intent.getStringExtra(EXTRA_ROUTE);
        if (route == null || route.isEmpty()) return;

        navigateToRoute(route, 250);
        navigateToRoute(route, 1000);
    }

    private void navigateToRoute(String route, long delayMs) {
        if (getBridge() == null || getBridge().getWebView() == null) return;

        getBridge().getWebView().postDelayed(() -> {
            String quotedRoute = JSONObject.quote(route);
            String quotedRouteKey = JSONObject.quote(PENDING_ROUTE_KEY);
            getBridge().getWebView().evaluateJavascript(
                "try{sessionStorage.setItem(" + quotedRouteKey + "," + quotedRoute + ");}catch(e){}" +
                    "window.location.assign(" + quotedRoute + ")",
                null
            );
        }, delayMs);
    }
}
