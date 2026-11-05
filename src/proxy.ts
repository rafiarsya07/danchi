import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Quick, optimistic check: no session cookie means straight to /login.
// The real check happens on the server in getMe() for every page and action.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|sos/|api/sos/live|api/auth|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js|offline.html|\\.well-known|icons/|mascot/).*)"],
};
