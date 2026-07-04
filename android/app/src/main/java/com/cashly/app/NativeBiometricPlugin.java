package com.cashly.app;

import android.app.Activity;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.Executor;

@CapacitorPlugin(name = "NativeBiometric")
public class NativeBiometricPlugin extends Plugin {
    private static final int AUTHENTICATORS =
        BiometricManager.Authenticators.BIOMETRIC_STRONG
            | BiometricManager.Authenticators.DEVICE_CREDENTIAL;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        int result = BiometricManager.from(getContext()).canAuthenticate(AUTHENTICATORS);
        ret.put("available", result == BiometricManager.BIOMETRIC_SUCCESS);
        ret.put("code", result);
        call.resolve(ret);
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        Activity activity = getActivity();
        if (!(activity instanceof FragmentActivity)) {
            call.reject("Activity not available");
            return;
        }

        int result = BiometricManager.from(getContext()).canAuthenticate(AUTHENTICATORS);
        if (result != BiometricManager.BIOMETRIC_SUCCESS) {
            call.reject("Fingerprint or device unlock is not available on this device.");
            return;
        }

        String title = call.getString("title", "Unlock Cashly");
        String subtitle = call.getString("subtitle", "Use fingerprint, face, or device PIN");
        Executor executor = ContextCompat.getMainExecutor(getContext());

        BiometricPrompt prompt = new BiometricPrompt(
            (FragmentActivity) activity,
            executor,
            new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationError(int errorCode, CharSequence errString) {
                    call.reject(errString != null ? errString.toString() : "Authentication failed");
                }

                @Override
                public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                    JSObject ret = new JSObject();
                    ret.put("verified", true);
                    call.resolve(ret);
                }

                @Override
                public void onAuthenticationFailed() {
                    notifyListeners("nativeBiometricFailed", new JSObject());
                }
            }
        );

        BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(AUTHENTICATORS)
            .build();

        activity.runOnUiThread(() -> prompt.authenticate(promptInfo));
    }
}
