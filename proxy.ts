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
//     our Resend send quota). Kept deliberately tight — this is a single-user app, so even
//     a handful of sign-in emails per window is already abnormal; a low cap shrinks the
//     inbox-bombing window without ever inconveniencing the one legitimate user.
const WINDOW_MS = 10 * 60_000;
const checkPerIpSignIn = createRateLimiter({ limit: 5, windowMs: WINDOW_MS });
const checkGlobalSignIn = createRateLimiter({ limit: 6, windowMs: WINDOW_MS });

// Demo-login rate limiting. POST /api/demo/login is the one write endpoint that is
// deliberately unauthenticated (each hit inserts a User + UserProfile row), which
// makes it the obvious DB-flooding target — so it gets its own limiters. A real
// visitor restarts the demo a handful of times at most; anything past these caps
// is abuse. Per-IP is generous for humans, the global cap bounds total row
// creation per hour even from rotating IPs.
const DEMO_WINDOW_MS = 60 * 60_000; // 1 hour
const checkPerIpDemo = createRateLimiter({ limit: 5, windowMs: DEMO_WINDOW_MS });
const checkGlobalDemo = createRateLimiter({ limit: 30, windowMs: DEMO_WINDOW_MS });

/**
 * Client IP for rate-limit keying. X-Forwarded-For is a comma list where each
 * proxy hop APPENDS the address it saw — so the RIGHTMOST entry is the one
 * written by Railway's edge (trustworthy), while everything to its left is
 * client-supplied and freely spoofable. Taking `[0]` (the previous behavior)
 * let an attacker mint a fresh per-IP bucket per request by sending a random
 * header value; taking the last entry keys on the address the attacker cannot
 * choose. If Bayana ever sits behind a second trusted proxy layer, index from
 * the end by the number of trusted hops instead.
 */
function clientIp(req: NextRequest): string {
  const hops = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return hops.at(-1) ?? "unknown";
}

/** Shared 429 for both throttled endpoints. */
function tooMany(retryAfterSeconds: number, what: string): NextResponse {
  return new NextResponse(`Too many ${what}. Please try again later.`, {
    status: 429,
    headers: { "Retry-After": String(retryAfterSeconds) },
  });
}

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
    const ip = clientIp(req);
    const perIp = checkPerIpSignIn(ip);
    const global = checkGlobalSignIn("global");
    const blocked = !perIp.allowed ? perIp : !global.allowed ? global : null;
    if (blocked) return tooMany(blocked.retryAfterSeconds, "sign-in attempts");
  }

  // Throttle demo-session creation (POST-only — see the route header for why the
  // endpoint no longer answers GET). Each request writes DB rows, so this is the
  // flood-control gate; the route itself adds the CSRF/origin check and cleanup.
  if (req.method === "POST" && pathname === "/api/demo/login") {
    const ip = clientIp(req);
    const perIp = checkPerIpDemo(ip);
    const global = checkGlobalDemo("global");
    const blocked = !perIp.allowed ? perIp : !global.allowed ? global : null;
    if (blocked) return tooMany(blocked.retryAfterSeconds, "demo sessions");
  }

  // Public: the marketing homepage, the sign-in page, all Auth.js endpoints, and the
  // demo login route (it creates the session, so it must be reachable without one) —
  // the exact path only, so future /api/demo/* additions don't silently ship public.
  // The dev-login bypass is only outside production (SPEC §11.7).
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/demo/login" ||
    (process.env.NODE_ENV !== "production" && pathname.startsWith("/api/dev"));
  // Demo cookie is the second valid session type — no Auth.js Session row.
  // Proxy only checks presence here; HMAC verification happens in getCurrentUserId().
  const hasSession =
    SESSION_COOKIES.some((name) => req.cookies.has(name)) ||
    req.cookies.has("bayana-demo-token");

  if (!isPublic && !hasSession) {
    return NextResponse.redirect(new URL("/auth/signin", req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except Next's static assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|icon.svg).*)"],
};
