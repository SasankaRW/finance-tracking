"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Lock,
  Fingerprint,
  Banknote,
  Palette,
  LogOut,
  MessageSquareText,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-provider";
import { useConfirm } from "@/components/confirm-dialog";
import { signOutEverywhere } from "@/lib/auth/auth-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resetPassword } from "@/lib/auth/auth-actions";
import {
  canUseBiometricUnlock,
  clearAppLock,
  disableBiometricUnlock,
  enableBiometricUnlock,
  getAppLockSettings,
  hasBiometric,
  hasPin,
  isAppLockConfigured,
  setAppLockPin,
} from "@/lib/app-lock";
import { SalaryPanel } from "@/app/app/settings/salary-panel";
import { AppearancePanel } from "@/app/app/settings/appearance-panel";
import { SmsRulesPanel } from "@/app/app/settings/sms-rules-panel";

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const defaultTab =
    searchParams.get("tab") === "salary"
      ? "salary"
      : searchParams.get("tab") === "security"
        ? "security"
        : searchParams.get("tab") === "messages"
          ? "messages"
          : "appearance";
  const { user } = useAuth();
  const confirm = useConfirm();

  // Security state
  const [resetLoading, setResetLoading] = React.useState(false);
  const [appLockSettings, setAppLockSettings] = React.useState(() =>
    user ? getAppLockSettings(user.uid) : null,
  );
  const [pin, setPin] = React.useState("");
  const [confirmPin, setConfirmPin] = React.useState("");
  const [pinLoading, setPinLoading] = React.useState(false);
  const [biometricLoading, setBiometricLoading] = React.useState(false);
  const [biometricSupported, setBiometricSupported] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    setAppLockSettings(user ? getAppLockSettings(user.uid) : null);
  }, [user]);

  React.useEffect(() => {
    void canUseBiometricUnlock().then(setBiometricSupported);
  }, []);

  const refreshAppLockSettings = () => {
    if (!user) return;
    setAppLockSettings(getAppLockSettings(user.uid));
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    setResetLoading(true);
    try {
      await resetPassword(user.email);
      toast.success("Reset email sent", {
        description: `We sent a password reset link to ${user.email}`,
      });
    } catch (err) {
      toast.error("Failed to send reset email", {
        description: err instanceof Error ? err.message : "Please try again later",
      });
    } finally {
      setResetLoading(false);
    }
  };

  const handleSavePin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    if (pin.length < 4) {
      toast.error("PIN must be at least 4 digits");
      return;
    }

    if (pin !== confirmPin) {
      toast.error("PINs do not match");
      return;
    }

    setPinLoading(true);
    try {
      await setAppLockPin(user.uid, pin);
      setPin("");
      setConfirmPin("");
      refreshAppLockSettings();
      toast.success("App lock PIN saved");
    } catch (err) {
      toast.error("Failed to save PIN", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setPinLoading(false);
    }
  };

  const handleEnableBiometric = async () => {
    if (!user) return;

    setBiometricLoading(true);
    try {
      await enableBiometricUnlock(user.uid, user.email);
      refreshAppLockSettings();
      toast.success("Fingerprint unlock enabled");
    } catch (err) {
      toast.error("Failed to enable fingerprint unlock", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleDisableBiometric = () => {
    if (!user) return;
    disableBiometricUnlock(user.uid);
    refreshAppLockSettings();
    toast.success("Fingerprint unlock disabled");
  };

  const handleClearAppLock = async () => {
    if (!user) return;
    if (!(await confirm({ title: "Turn off Cashly app lock on this device?", destructive: true }))) return;

    clearAppLock(user.uid);
    refreshAppLockSettings();
    setPin("");
    setConfirmPin("");
    toast.success("App lock turned off");
  };

  const pinConfigured = hasPin(appLockSettings);
  const biometricConfigured = hasBiometric(appLockSettings);
  const appLockConfigured = isAppLockConfigured(appLockSettings);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage appearance, salary, and security
          </p>
        </div>
      </div>

      <Tabs defaultValue={defaultTab} key={defaultTab} className="space-y-4 sm:space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-4 gap-1 p-1 sm:inline-flex sm:h-11 sm:w-fit sm:gap-0">
          <TabsTrigger
            value="appearance"
            className="h-auto min-h-11 flex-none flex-col gap-0.5 px-1 py-2 text-[10px] leading-none sm:h-full sm:flex-1 sm:flex-row sm:gap-2 sm:px-4 sm:py-1 sm:text-sm"
          >
            <Palette className="h-4 w-4 shrink-0" />
            <span className="max-w-full truncate">Appearance</span>
          </TabsTrigger>
          <TabsTrigger
            value="salary"
            className="h-auto min-h-11 flex-none flex-col gap-0.5 px-1 py-2 text-[10px] leading-none sm:h-full sm:flex-1 sm:flex-row sm:gap-2 sm:px-4 sm:py-1 sm:text-sm"
          >
            <Banknote className="h-4 w-4 shrink-0" />
            <span className="max-w-full truncate">Salary</span>
          </TabsTrigger>
          <TabsTrigger
            value="messages"
            className="h-auto min-h-11 flex-none flex-col gap-0.5 px-1 py-2 text-[10px] leading-none sm:h-full sm:flex-1 sm:flex-row sm:gap-2 sm:px-4 sm:py-1 sm:text-sm"
          >
            <MessageSquareText className="h-4 w-4 shrink-0" />
            <span className="max-w-full truncate">Messages</span>
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="h-auto min-h-11 flex-none flex-col gap-0.5 px-1 py-2 text-[10px] leading-none sm:h-full sm:flex-1 sm:flex-row sm:gap-2 sm:px-4 sm:py-1 sm:text-sm"
          >
            <Lock className="h-4 w-4 shrink-0" />
            <span className="max-w-full truncate">Security</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appearance">
          <AppearancePanel />
        </TabsContent>

        <TabsContent value="salary">
          <SalaryPanel />
        </TabsContent>

        <TabsContent value="messages">
          <SmsRulesPanel />
        </TabsContent>

        <TabsContent value="security" className="max-w-xl">
          <Card className="surface-tonal">
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Manage your profile security and password
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium">Email Address</h3>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>

                <div className="pt-4 border-t">
                  <h3 className="text-sm font-medium mb-3">Password</h3>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Update your password securely via email
                    </div>
                    <Button onClick={handleResetPassword} disabled={resetLoading}>
                      {resetLoading ? "Sending..." : "Reset Password"}
                    </Button>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-medium">App Lock</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Protect this device with fingerprint/device unlock or a Cashly PIN.
                      </p>
                    </div>
                    <Badge variant={appLockConfigured ? "secondary" : "outline"}>
                      {appLockConfigured ? "On" : "Off"}
                    </Badge>
                  </div>

                  <form onSubmit={handleSavePin} className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="new-app-lock-pin">
                          {pinConfigured ? "Change PIN" : "New PIN"}
                        </Label>
                        <Input
                          id="new-app-lock-pin"
                          value={pin}
                          onChange={(event) =>
                            setPin(event.target.value.replace(/\D/g, "").slice(0, 8))
                          }
                          type="password"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoComplete="new-password"
                          placeholder="4-8 digits"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-app-lock-pin">Confirm PIN</Label>
                        <Input
                          id="confirm-app-lock-pin"
                          value={confirmPin}
                          onChange={(event) =>
                            setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 8))
                          }
                          type="password"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoComplete="new-password"
                          placeholder="Repeat PIN"
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      variant="secondary"
                      disabled={pinLoading || !pin || !confirmPin}
                    >
                      {pinLoading ? "Saving..." : pinConfigured ? "Change PIN" : "Set PIN"}
                    </Button>
                  </form>

                  <div className="mt-5 rounded-3xl border bg-background/50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-2xl bg-primary/10 p-2 text-primary">
                          <Fingerprint className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium">Fingerprint / Device Unlock</h4>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Uses your phone screen lock, such as fingerprint, face, or device PIN.
                          </p>
                          {biometricSupported === false && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Not available on this device. Add a screen lock or enrolled fingerprint, then reopen Cashly.
                            </p>
                          )}
                        </div>
                      </div>
                      {biometricConfigured ? (
                        <Button type="button" variant="outline" onClick={handleDisableBiometric}>
                          Disable
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          onClick={() => void handleEnableBiometric()}
                          disabled={biometricLoading || biometricSupported === false}
                        >
                          {biometricLoading ? "Enabling..." : "Enable"}
                        </Button>
                      )}
                    </div>
                  </div>

                  {appLockConfigured && (
                    <Button
                      type="button"
                      variant="destructive"
                      className="mt-5"
                      onClick={() => void handleClearAppLock()}
                    >
                      Turn Off App Lock
                    </Button>
                  )}
                </div>

                <div className="pt-4 border-t">
                  <h3 className="text-sm font-medium">Session</h3>
                  <div className="mt-3 flex items-center justify-between gap-4">
                    <p className="text-sm text-muted-foreground">
                      Sign out of Cashly on this device.
                    </p>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => signOutEverywhere()}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
