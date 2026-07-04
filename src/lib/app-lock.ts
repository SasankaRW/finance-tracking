import { Capacitor, registerPlugin } from "@capacitor/core";

export type AppLockSettings = {
  pinSalt?: string;
  pinHash?: string;
  biometricCredentialId?: string;
  biometricEnabled?: boolean;
  updatedAt: number;
};

const STORAGE_PREFIX = "cashly:app-lock:v1";
const PIN_ITERATIONS = 150_000;
const NATIVE_BIOMETRIC_CREDENTIAL_ID = "native-biometric";

interface NativeBiometricPlugin {
  isAvailable(): Promise<{ available: boolean; code?: number }>;
  authenticate(options?: { title?: string; subtitle?: string }): Promise<{ verified: boolean }>;
}

const NativeBiometric = registerPlugin<NativeBiometricPlugin>("NativeBiometric");

function isAndroidNative() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

function storageKey(uid: string) {
  return `${STORAGE_PREFIX}:${uid}`;
}

function bytesToBase64Url(bytes: Uint8Array) {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function getStoredSettings(uid: string): AppLockSettings | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return null;
    return JSON.parse(raw) as AppLockSettings;
  } catch {
    return null;
  }
}

function saveSettings(uid: string, settings: AppLockSettings | null) {
  if (typeof window === "undefined") return;

  if (!settings) {
    localStorage.removeItem(storageKey(uid));
    return;
  }

  localStorage.setItem(storageKey(uid), JSON.stringify(settings));
}

async function hashPin(pin: string, salt: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: base64UrlToBytes(salt),
      iterations: PIN_ITERATIONS,
    },
    key,
    256,
  );

  return bytesToBase64Url(new Uint8Array(bits));
}

function timingSafeEqual(a: string, b: string) {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = aBytes.length ^ bBytes.length;
  const length = Math.max(aBytes.length, bBytes.length);

  for (let i = 0; i < length; i += 1) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }

  return diff === 0;
}

function credentialOptions(uid: string, email: string | null | undefined) {
  const encoder = new TextEncoder();

  return {
    publicKey: {
      challenge: randomBytes(32),
      rp: {
        name: "Cashly",
      },
      user: {
        id: encoder.encode(uid),
        name: email ?? "Cashly user",
        displayName: email ?? "Cashly user",
      },
      pubKeyCredParams: [
        { type: "public-key" as const, alg: -7 },
        { type: "public-key" as const, alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform" as const,
        residentKey: "discouraged" as const,
        userVerification: "required" as const,
      },
      timeout: 60_000,
      attestation: "none" as const,
    },
  };
}

export function getAppLockSettings(uid: string) {
  return getStoredSettings(uid);
}

export function isAppLockConfigured(settings: AppLockSettings | null) {
  return Boolean(settings?.pinHash || (settings?.biometricEnabled && settings.biometricCredentialId));
}

export function hasPin(settings: AppLockSettings | null) {
  return Boolean(settings?.pinHash && settings.pinSalt);
}

export function hasBiometric(settings: AppLockSettings | null) {
  return Boolean(settings?.biometricEnabled && settings.biometricCredentialId);
}

export async function canUseBiometricUnlock() {
  if (isAndroidNative()) {
    try {
      const { available } = await NativeBiometric.isAvailable();
      return available;
    } catch {
      return false;
    }
  }

  if (typeof window === "undefined" || !window.PublicKeyCredential || !navigator.credentials) {
    return false;
  }

  if (!PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
    return true;
  }

  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function setAppLockPin(uid: string, pin: string) {
  const settings = getStoredSettings(uid) ?? { updatedAt: Date.now() };
  const salt = bytesToBase64Url(randomBytes(16));

  saveSettings(uid, {
    ...settings,
    pinSalt: salt,
    pinHash: await hashPin(pin, salt),
    updatedAt: Date.now(),
  });
}

export async function verifyAppLockPin(uid: string, pin: string) {
  const settings = getStoredSettings(uid);
  if (!settings?.pinSalt || !settings.pinHash) return false;

  const hash = await hashPin(pin, settings.pinSalt);
  return timingSafeEqual(hash, settings.pinHash);
}

export async function enableBiometricUnlock(uid: string, email?: string | null) {
  if (!(await canUseBiometricUnlock())) {
    throw new Error("Fingerprint or device unlock is not available on this device.");
  }

  if (isAndroidNative()) {
    const result = await NativeBiometric.authenticate({
      title: "Enable Cashly unlock",
      subtitle: "Confirm with fingerprint, face, or device PIN",
    });

    if (!result.verified) {
      throw new Error("Device unlock was not accepted.");
    }

    const settings = getStoredSettings(uid) ?? { updatedAt: Date.now() };
    saveSettings(uid, {
      ...settings,
      biometricEnabled: true,
      biometricCredentialId: NATIVE_BIOMETRIC_CREDENTIAL_ID,
      updatedAt: Date.now(),
    });
    return;
  }

  const credential = await navigator.credentials.create(credentialOptions(uid, email));

  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error("Could not create a biometric unlock credential.");
  }

  const settings = getStoredSettings(uid) ?? { updatedAt: Date.now() };

  saveSettings(uid, {
    ...settings,
    biometricEnabled: true,
    biometricCredentialId: bytesToBase64Url(new Uint8Array(credential.rawId)),
    updatedAt: Date.now(),
  });
}

export async function verifyBiometricUnlock(uid: string) {
  const settings = getStoredSettings(uid);
  if (!settings?.biometricCredentialId) return false;

  if (isAndroidNative()) {
    const result = await NativeBiometric.authenticate({
      title: "Unlock Cashly",
      subtitle: "Use fingerprint, face, or device PIN",
    });

    if (result.verified && settings.biometricCredentialId !== NATIVE_BIOMETRIC_CREDENTIAL_ID) {
      saveSettings(uid, {
        ...settings,
        biometricCredentialId: NATIVE_BIOMETRIC_CREDENTIAL_ID,
        updatedAt: Date.now(),
      });
    }

    return result.verified;
  }

  const credentialId = base64UrlToBytes(settings.biometricCredentialId);
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [
        {
          id: credentialId,
          type: "public-key",
        },
      ],
      userVerification: "required",
      timeout: 60_000,
    },
  });

  return credential instanceof PublicKeyCredential;
}

export function disableBiometricUnlock(uid: string) {
  const settings = getStoredSettings(uid);
  if (!settings) return;

  const next = {
    ...settings,
    biometricEnabled: false,
    biometricCredentialId: undefined,
    updatedAt: Date.now(),
  };

  saveSettings(uid, isAppLockConfigured(next) ? next : null);
}

export function clearAppLock(uid: string) {
  saveSettings(uid, null);
}
