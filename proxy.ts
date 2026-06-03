// Route guard. Next.js 16 uses `proxy.ts` (not `middleware.ts`) and runs it in the
// Node.js runtime by default.
//
// This is a coarse, fast gate: requests without a session cookie are redirected to the
// sign-in page. It is a UX convenience, NOT the security boundary — real validation
// happens server-side via `auth()` in the study page and in each API route
// (getCurrentUserId), which also rejects expired/invalid sessions. We deliberately don't
// hit the database here to keep the guard cheap.
import { NextResponse, type NextRequest } from "next/server";

// Auth.js v5 session cookie names (dev vs. https/prod).
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public: the sign-in page and all Auth.js endpoints (sign-in, callback, etc.).
  const isPublic = pathname.startsWith("/auth") || pathname.startsWith("/api/auth");
  const hasSession = SESSION_COOKIES.some((name) => req.cookies.has(name));

  if (!isPublic && !hasSession) {
    return NextResponse.redirect(new URL("/auth/signin", req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except Next's static assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|icon.svg).*)"],
};
