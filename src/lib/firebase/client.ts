import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  type Firestore,
} from "firebase/firestore";
import { getClientEnv } from "@/lib/env";

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;

export function getFirebaseApp() {
  if (_app) return _app;

  const env = getClientEnv();
  const config = {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    measurementId: env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };

  _app = getApps().length ? getApp() : initializeApp(config);
  return _app;
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

export function getFirebaseDb() {
  if (_db) return _db;
  const isDev = process.env.NODE_ENV === 'development';
  const isBrowser = typeof window !== 'undefined';
  const isNativeApp =
    isBrowser &&
    Boolean((window as any).Capacitor?.isNativePlatform?.() ?? (window as any).Capacitor);

  _db = initializeFirestore(getFirebaseApp(), {
    localCache: (isDev || !isBrowser || isNativeApp)
      ? memoryLocalCache()
      : persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
  });
  return _db;
}


