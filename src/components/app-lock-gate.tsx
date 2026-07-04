"use client";

import * as React from "react";
import { Delete, Fingerprint, LockKeyhole, ShieldCheck } from "lucide-react";
import type { User } from "firebase/auth";
import {
  getAppLockSettings,
  hasBiometric,
  hasPin,
  isAppLockConfigured,
  verifyAppLockPin,
  verifyBiometricUnlock,
} from "@/lib/app-lock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LOCK_AFTER_BACKGROUND_MS = 5 * 60_000;
const UNLOCK_SESSION_PREFIX = "cashly:app-lock-unlocked-until:v1:";

function unlockSessionKey(uid: string) {
  return `${UNLOCK_SESSION_PREFIX}${uid}`;
}

function readUnlockSessionFresh(uid: string) {
  try {
    const raw = window.localStorage.getItem(unlockSessionKey(uid));
    const unlockedUntil = raw ? Number(raw) : 0;
    return Number.isFinite(unlockedUntil) && unlockedUntil > Date.now();
  } catch {
    return false;
  }
}

function rememberUnlockSession(uid: string) {
  try {
    window.localStorage.setItem(
      unlockSessionKey(uid),
      String(Date.now() + LOCK_AFTER_BACKGROUND_MS),
    );
  } catch {
    // Ignore storage failures; the lock still works for the current mount.
  }
}

function clearUnlockSession(uid: string) {
  try {
    window.localStorage.removeItem(unlockSessionKey(uid));
  } catch {
    // ignore
  }
}

export function AppLockGate({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const [settings, setSettings] = React.useState(() => getAppLockSettings(user.uid));
  const [unlocked, setUnlocked] = React.useState(() => {
    return !isAppLockConfigured(settings) || readUnlockSessionFresh(user.uid);
  });
  const [pin, setPin] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [showPinEntry, setShowPinEntry] = React.useState(false);

  const configured = isAppLockConfigured(settings);
  const biometricReady = hasBiometric(settings);
  const pinReady = hasPin(settings);

  const refreshSettings = React.useCallback(() => {
    const next = getAppLockSettings(user.uid);
    setSettings(next);

    if (!isAppLockConfigured(next)) {
      clearUnlockSession(user.uid);
      setUnlocked(true);
    } else if (readUnlockSessionFresh(user.uid)) {
      setUnlocked(true);
    }
  }, [user.uid]);

  React.useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  React.useEffect(() => {
    const lockIfSessionExpired = () => {
      if (
        isAppLockConfigured(getAppLockSettings(user.uid)) &&
        !readUnlockSessionFresh(user.uid)
      ) {
        setUnlocked(false);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (unlocked && isAppLockConfigured(getAppLockSettings(user.uid))) {
          rememberUnlockSession(user.uid);
        }
        return;
      }

      if (document.visibilityState === "visible") {
        refreshSettings();
        lockIfSessionExpired();
      }
    };

    window.addEventListener("focus", lockIfSessionExpired);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", lockIfSessionExpired);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshSettings, unlocked, user.uid]);

  const unlockWithBiometric = React.useCallback(async () => {
    setBusy(true);
    setError(null);

    try {
      const ok = await verifyBiometricUnlock(user.uid);
      if (!ok) {
        setError("Fingerprint unlock was not accepted.");
        return;
      }

      setUnlocked(true);
      rememberUnlockSession(user.uid);
      setPin("");
      setShowPinEntry(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fingerprint unlock failed.");
    } finally {
      setBusy(false);
    }
  }, [user.uid]);

  React.useEffect(() => {
    if (!unlocked && biometricReady) {
      setShowPinEntry(false);
      void unlockWithBiometric();
    }
  }, [biometricReady, unlocked, unlockWithBiometric]);

  const submitPin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const ok = await verifyAppLockPin(user.uid, pin);
      if (!ok) {
        setError("Incorrect PIN.");
        return;
      }

      setUnlocked(true);
      rememberUnlockSession(user.uid);
      setPin("");
      setShowPinEntry(false);
    } finally {
      setBusy(false);
    }
  };

  const appendPinDigit = (digit: string) => {
    setError(null);
    setPin((current) => `${current}${digit}`.slice(0, 8));
  };

  const deletePinDigit = () => {
    setError(null);
    setPin((current) => current.slice(0, -1));
  };

  if (!configured || unlocked) {
    return <>{children}</>;
  }

  const shouldShowPinEntry = pinReady && (!biometricReady || showPinEntry);

  return (
    <main className="relative flex min-h-dvh overflow-hidden bg-[radial-gradient(circle_at_50%_-10%,var(--hero-glow)_0%,transparent_32%),linear-gradient(180deg,var(--background),var(--muted))] px-6 py-8 text-foreground">
      <div className="pointer-events-none absolute -right-20 top-12 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />

      <section className="relative mx-auto flex w-full max-w-sm flex-col">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-primary text-primary-foreground shadow-2xl shadow-primary/25">
            {biometricReady && !showPinEntry ? (
              <Fingerprint className="h-11 w-11" />
            ) : (
              <LockKeyhole className="h-11 w-11" />
            )}
          </div>

          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.24em] text-primary">
            Cashly locked
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            {shouldShowPinEntry ? "Enter your PIN" : "Unlock Cashly"}
          </h1>
          <p className="mt-3 max-w-72 text-sm leading-6 text-muted-foreground">
            {biometricReady && !showPinEntry
              ? "Use fingerprint or device unlock to continue."
              : "Use your Cashly PIN to continue."}
          </p>

          {error && (
            <p className="mt-5 rounded-full bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="space-y-5 pb-2">
          {biometricReady && !showPinEntry && (
            <Button
              type="button"
              className="h-14 w-full rounded-full text-base shadow-lg shadow-primary/20"
              disabled={busy}
              onClick={() => void unlockWithBiometric()}
            >
              <Fingerprint className="h-4 w-4" />
              {busy ? "Waiting for unlock..." : "Unlock with fingerprint"}
            </Button>
          )}

          {pinReady && biometricReady && !showPinEntry && (
            <Button
              type="button"
              variant="ghost"
              className="h-12 w-full rounded-full text-muted-foreground"
              disabled={busy}
              onClick={() => {
                setError(null);
                setShowPinEntry(true);
              }}
            >
              Use PIN instead
            </Button>
          )}

          {shouldShowPinEntry && (
            <form onSubmit={submitPin} className="space-y-6">
              <Input
                id="app-lock-pin"
                value={pin}
                onChange={(event) =>
                  setPin(event.target.value.replace(/\D/g, "").slice(0, 8))
                }
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="current-password"
                placeholder="Enter PIN"
                className="sr-only"
                autoFocus
              />

              <div className="space-y-5">
                <div className="flex items-center justify-center gap-3" aria-hidden>
                  {Array.from({ length: 8 }).map((_, index) => (
                    <span
                      key={index}
                      className={`h-3.5 w-3.5 rounded-full transition-all ${
                        index < pin.length
                          ? "scale-110 bg-primary shadow-md shadow-primary/25"
                          : "bg-muted-foreground/20"
                      }`}
                    />
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      disabled={busy}
                      onClick={() => appendPinDigit(digit)}
                      className="press-expressive h-16 rounded-full bg-background/70 text-2xl font-semibold shadow-sm ring-1 ring-border/70 backdrop-blur transition-colors hover:bg-background disabled:opacity-50"
                    >
                      {digit}
                    </button>
                  ))}
                  <span />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => appendPinDigit("0")}
                    className="press-expressive h-16 rounded-full bg-background/70 text-2xl font-semibold shadow-sm ring-1 ring-border/70 backdrop-blur transition-colors hover:bg-background disabled:opacity-50"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    disabled={busy || pin.length === 0}
                    onClick={deletePinDigit}
                    className="press-expressive flex h-16 items-center justify-center rounded-full bg-background/70 shadow-sm ring-1 ring-border/70 backdrop-blur transition-colors hover:bg-background disabled:opacity-40"
                    aria-label="Delete last PIN digit"
                  >
                    <Delete className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="h-14 w-full rounded-full text-base shadow-lg shadow-primary/20"
                disabled={busy || pin.length < 4}
              >
                <ShieldCheck className="h-4 w-4" />
                {busy ? "Unlocking..." : "Unlock with PIN"}
              </Button>

              {biometricReady && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 w-full rounded-full text-muted-foreground"
                  disabled={busy}
                  onClick={() => {
                    setPin("");
                    setError(null);
                    setShowPinEntry(false);
                    void unlockWithBiometric();
                  }}
                >
                  Use fingerprint instead
                </Button>
              )}
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
