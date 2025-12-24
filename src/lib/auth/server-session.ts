import "server-only";

import { cookies } from "next/headers";
import { getAdminAuth } from "@/lib/firebase/admin";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days

export function getSessionCookieName() {
  return process.env.FINTRACK_SESSION_COOKIE_NAME ?? "fintrack_session";
}

export async function getServerSessionUid() {
  const cookieName = getSessionCookieName();
  const sessionCookie = cookies().get(cookieName)?.value;
  if (!sessionCookie) return null;

  try {
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function requireAuthedUid() {
  const cookieName = getSessionCookieName();
  const sessionCookie = cookies().get(cookieName)?.value;
  if (!sessionCookie) return null;

  try {
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    return decoded.uid;
  } catch {
    return null;
  }
}

export const SESSION = {
  maxAgeSeconds: SESSION_MAX_AGE_SECONDS,
};


