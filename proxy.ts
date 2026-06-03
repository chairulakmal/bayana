// Route guard. Next.js 16 uses `proxy.ts` (not `middleware.ts`) and runs it in the
// Node.js runtime by default.
//
// This is a coarse, fast gate: requests without a session cookie are redirected to the
// sign-in page. It is a UX convenience, NOT the security boundary — real validation
// happens server-side via `auth()` in the study page and in each API route
// (getCurrentUserId), which also rejects expired/invalid sessions. We deliberately don't
// hit the database here to keep the guard cheap.
import { NextResponse, type NextRequest } from "next/server";
import { createRateLimiter } from "@/lib/rate-limit";

// Auth.js v5 session cookie names (dev vs. https/prod).
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

// Sign-in rate limiting (SPEC §11.3 #5). Two independent limiters, both per 10-minute
// window. These live at module scope so their counters persist across requests in the
// Node process (the proxy runs in the Node runtime — see header).
//   - perIp: stops a single client from hammering the endpoint or guessing.
//   - global: the allowlist means only ONE inbox can ever receive a link, so a global cap
//     is the real defense against inbox-bombing even from rotating IPs (and it protects
//     our Resend send quota). Kept comfortably above perIp so a lone legit user is never
//     blocked by it.
const WINDOW_MS = 10 * 60_000;
const checkPerIpSignIn = createRateLimiter({ limit: 5, windowMs: WINDOW_MS });
const checkGlobalSignIn = createRateLimiter({ limit: 20, windowMs: WINDOW_MS });

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Throttle the sign-in *request* (the action that triggers a magic-link email). Our
  // sign-in is a Server Action, so the browser POSTs to the page path `/auth/signin`;
  // we also cover the raw Auth.js endpoint `/api/auth/signin/*` in case it's hit directly.
  // Only POSTs matter — GET is just rendering the page.
  const isSignInRequest =
    req.method === "POST" &&
    (pathname === "/auth/signin" || pathname.startsWith("/api/auth/signin"));

  if (isSignInRequest) {
    // Behind Railway's proxy, the client IP is the first entry of X-Forwarded-For.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const perIp = checkPerIpSignIn(ip);
    const global = checkGlobalSignIn("global");
    const blocked = !perIp.allowed ? perIp : !global.allowed ? global : null;
    if (blocked) {
      return new NextResponse("Too many sign-in attempts. Please try again later.", {
        status: 429,
        headers: { "Retry-After": String(blocked.retryAfterSeconds) },
      });
    }
  }

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
