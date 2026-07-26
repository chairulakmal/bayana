// POST /api/demo/login
//
// Starts an ephemeral demo session — no email required. Available in production
// (unlike /api/dev/login which requires DEV_AUTH=1 and is 404 in prod).
//
// Each click generates a fresh identity:
//   1. Creates a new User (no email) + UserProfile (no onboardedAt) in the DB.
//   2. Signs `userId:expiresAtMs` with HMAC-SHA256 keyed by AUTH_SECRET.
//   3. Writes a 7-day httpOnly cookie — the *only* key to those DB rows.
//   4. Redirects (303) to /onboarding (no onboardedAt → treated as a new user),
//      which on completion lands on /home, the app's default page.
//
// Demo users go through onboarding rather than skipping it: the level choice is what
// scopes every engine (§8.5), and picking it themselves means the hub's counts and
// progress bar describe a level they actually chose. It costs one tap.
//
// The previous demo session's DB rows are silently orphaned. Without the cookie
// they are unreachable, so the user's data is effectively ephemeral. This is the
// design: the cookie IS the identity. Lose the cookie → lose the data.
//
// Security (SPEC §11.8) — this route is unauthenticated BY DESIGN, so it is the
// one write endpoint anyone on the internet can hit. Three layers keep that safe:
//   - POST-only (was GET): a state-changing GET can be fired cross-site by an
//     <img src=…> or a link prefetch with no user intent. Now GET returns 405.
//   - Same-origin check: browsers attach an Origin header to cross-site POSTs;
//     we reject any Origin that isn't our own (curl sends none and passes, but
//     scripted abuse is what the rate limiter below is for).
//   - Rate limiting in proxy.ts (per-IP + global): bounds how fast anyone can
//     mint rows, since each request inserts a User + UserProfile.
//
// Cleanup: expired demo users are deleted opportunistically on each new demo
// login, as a backstop. The sweep that actually keeps the privacy policy's
// 14-day retention promise is the scheduled one (scripts/cleanup-demo-users.ts);
// this call is redundant with it and kept because it costs one indexed DELETE on
// a path that already writes. See `src/lib/demo-cleanup.ts` for the rule itself
// and for why the filter is deliberately narrow.
//
// The identity check happens in getCurrentUserId() / requireAuth()
// (src/lib/current-user.ts), which verifies the HMAC and the signed expiry
// before trusting the userId in the cookie. No Auth.js Session row exists.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  createDemoCookieValue,
  DEMO_COOKIE_NAME,
  DEMO_COOKIE_TTL_MS,
} from "@/lib/current-user";
import { deleteStaleDemoUsers } from "@/lib/demo-cleanup";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Use AUTH_URL for the public origin. In Railway, `request.url` reflects the
  // internal host (localhost:8080), not the public domain — AUTH_URL is the
  // reliable source of the public origin in both dev and prod.
  const origin = process.env.AUTH_URL
    ? new URL(process.env.AUTH_URL).origin
    : new URL(request.url).origin;

  // CSRF guard: browsers send an Origin header on cross-site POSTs. A mismatch
  // means some other site tried to create rows in our DB on a visitor's behalf.
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== origin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Opportunistic cleanup before creating a new row. This is the *backstop*; the
  // scheduled sweep is what keeps the retention promise (see the header). It stays
  // because it costs one indexed DELETE on a path that already writes, and it means
  // a paused or unconfigured cron still leaves the table bounded. Failures here must
  // never block the login.
  try {
    await deleteStaleDemoUsers();
  } catch (err) {
    console.error("Demo cleanup failed (continuing):", err);
  }

  // Create a real User row (required for UserProfile FK) with no email — the
  // Prisma default generates a cuid() for the id.
  const user = await db.user.create({ data: {} });

  // Create the UserProfile without onboardedAt so the user is routed through
  // first-run onboarding, just like any new signed-up user.
  await db.userProfile.create({ data: { userId: user.id } });

  // Sign userId + expiry together — the server rejects the cookie after this
  // instant regardless of what the browser does (see current-user.ts).
  const expiresAtMs = Date.now() + DEMO_COOKIE_TTL_MS;
  const cookieValue = createDemoCookieValue(user.id, expiresAtMs);

  // 303 See Other: the canonical "POST succeeded, now GET this page" redirect —
  // it forces the follow-up request to be a GET rather than a replayed POST.
  const res = NextResponse.redirect(new URL("/onboarding", origin), 303);
  res.cookies.set(DEMO_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAtMs),
    // Secure in production; relaxed in dev (http://localhost).
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
