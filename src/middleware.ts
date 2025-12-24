import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE_NAME =
  process.env.FINTRACK_SESSION_COOKIE_NAME ?? "fintrack_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isAuthed = Boolean(sessionCookie);

  // Auth pages
  if (pathname === "/login" || pathname === "/signup") {
    if (isAuthed) {
      const url = req.nextUrl.clone();
      url.pathname = "/app";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // App pages
  if (pathname.startsWith("/app")) {
    if (!isAuthed) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/login", "/signup"],
};


