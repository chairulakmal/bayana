// GET /api/demo/login
//
// Starts an ephemeral demo session — no email required. Available in production
// (unlike /api/dev/login which requires DEV_AUTH=1 and is 404 in prod).
//
// Each click generates a fresh identity:
//   1. Creates a new User (no email) + UserProfile (no onboardedAt) in the DB.
//   2. Signs the userId with HMAC-SHA256 keyed by AUTH_SECRET.
//   3. Writes a 7-day httpOnly cookie — the *only* key to those DB rows.
//   4. Redirects to /onboarding (no onboardedAt → treated as a new user).
//
// The previous demo session's DB rows are silently orphaned. Without the cookie
// they are unreachable, so the user's data is effectively ephemeral. This is the
// design: the cookie IS the identity. Lose the cookie → lose the data.
//
// Security: no Auth.js Session row is created. The identity check happens in
// getCurrentUserId() / requireAuth() (src/lib/current-user.ts) which verifies the
// HMAC before trusting the userId in the cookie.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signDemoUserId, DEMO_COOKIE_NAME, DEMO_COOKIE_TTL_MS } from "@/lib/current-user";

export const runtime = "nodejs";

export async function GET(request: Request) {
  // Create a real User row (required for UserProfile FK) with no email — the
  // Prisma default generates a cuid() for the id.
  const user = await db.user.create({ data: {} });

  // Create the UserProfile without onboardedAt so the user is routed through
  // first-run onboarding, just like any new signed-up user.
  await db.userProfile.create({ data: { userId: user.id } });

  // Sign the userId so the cookie cannot be forged to impersonate another user.
  const cookieValue = `${user.id}:${signDemoUserId(user.id)}`;
  const expires = new Date(Date.now() + DEMO_COOKIE_TTL_MS);

  // Use AUTH_URL for the redirect base. In Railway, `request.url` reflects the
  // internal host (localhost:8080), not the public domain — AUTH_URL is the
  // reliable source of the public origin in both dev and prod.
  const origin = process.env.AUTH_URL
    ? new URL(process.env.AUTH_URL).origin
    : new URL(request.url).origin;
  const res = NextResponse.redirect(new URL("/onboarding", origin));
  res.cookies.set(DEMO_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
    // Secure in production; relaxed in dev (http://localhost).
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
