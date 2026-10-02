import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic check only: send visitors without any session cookie to /login.
 * Real verification happens server-side in every page and API route.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.getAll().some((c) => c.name === "friday_session" || /^sb-.*-auth-token/.test(c.name));
  if (!hasSession) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  // Pages only. API routes authenticate themselves (session or API key).
  matcher: ["/((?!api|auth|login|_next/static|_next/image|favicon.ico).*)"],
};
