import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAuth } from "@/lib/firebase/admin";
import { getSessionCookieName, SESSION } from "@/lib/auth/server-session";

const createSessionSchema = z.object({
  idToken: z.string().min(1),
});

export async function POST(req: Request) {
  const body = createSessionSchema.parse(await req.json());
  const adminAuth = getAdminAuth();

  // Verify the ID token and mint an HttpOnly session cookie.
  const decoded = await adminAuth.verifyIdToken(body.idToken, true);
  const sessionCookie = await adminAuth.createSessionCookie(body.idToken, {
    expiresIn: SESSION.maxAgeSeconds * 1000,
  });

  const res = NextResponse.json({ uid: decoded.uid });
  res.cookies.set(getSessionCookieName(), sessionCookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION.maxAgeSeconds,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(getSessionCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}


