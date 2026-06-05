// Resolves the acting user for a request — the real security boundary.
//
// Two session paths:
//   1. Auth.js database session (magic-link sign-in) — the normal path.
//   2. Demo cookie — a signed `userId:hmac` cookie for ephemeral demo accounts.
//      The cookie is the *only* key to the user's DB rows; lose the cookie and
//      the data is unreachable (effectively ephemeral from the user's perspective).
//
// `requireAuth()` is the primary helper for page Server Components: it resolves
// the session, falls back to demo, and redirects to /auth/signin if neither is present.
// Returns `{ userId, email, isDemo }` so pages can gate demo-specific UI in one call.
//
// `getCurrentUserId()` is the lightweight variant for API route handlers: it
// returns the userId or throws, trusting the caller to return 401.
//
// Cookie format: `<cuid>:<hmac-sha256-hex>` — signed with AUTH_SECRET so a user
// cannot forge a demo session for an arbitrary userId. Constant-time comparison
// prevents timing-based forgery detection.

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const DEMO_COOKIE_NAME = "bayana-demo-token";
export const DEMO_COOKIE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ---------------------------------------------------------------------------
// Cookie signing helpers
// ---------------------------------------------------------------------------

/** HMAC-SHA256 of `userId` keyed by AUTH_SECRET. Returns a 64-char hex string. */
export function signDemoUserId(userId: string): string {
  const secret = process.env.AUTH_SECRET ?? "";
  return createHmac("sha256", secret).update(userId).digest("hex");
}

/**
 * Parses and verifies a demo cookie value. Returns the userId on success, null
 * if the value is missing, malformed, or the HMAC doesn't match.
 *
 * Uses `timingSafeEqual` to prevent timing-based attacks — never compare HMACs
 * with `===` or `!==`, which short-circuits on the first differing byte.
 */
function verifyDemoCookie(value: string): string | null {
  const colonIdx = value.lastIndexOf(":");
  if (colonIdx === -1) return null;
  const userId = value.slice(0, colonIdx);
  const providedSig = value.slice(colonIdx + 1);
  if (!userId || providedSig.length !== 64) return null; // SHA-256 hex is always 64 chars

  const expectedSig = signDemoUserId(userId);
  try {
    const a = Buffer.from(providedSig, "hex");
    const b = Buffer.from(expectedSig, "hex");
    if (a.length !== b.length) return null;
    return timingSafeEqual(a, b) ? userId : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Primary helper for page Server Components. Resolves the current user from either
 * an Auth.js database session or a signed demo cookie. Redirects to /auth/signin
 * if neither is present.
 *
 * Returns `{ userId, email, isDemo }`:
 *   - `email` is null for demo accounts (they have no email).
 *   - `isDemo` gates demo-specific UI (warning banner, different sign-out action).
 */
export async function requireAuth(): Promise<{
  userId: string;
  email: string | null;
  isDemo: boolean;
}> {
  // Real Auth.js database session (magic-link users).
  const session = await auth();
  if (session?.user?.id) {
    return { userId: session.user.id, email: session.user.email ?? null, isDemo: false };
  }

  // Demo cookie fallback.
  const jar = await cookies();
  const raw = jar.get(DEMO_COOKIE_NAME)?.value;
  if (raw) {
    const userId = verifyDemoCookie(raw);
    if (userId) return { userId, email: null, isDemo: true };
  }

  // Neither present → send to sign-in.
  redirect("/auth/signin");
}

/**
 * Lightweight variant for API route handlers: returns the userId or throws so
 * the route can return 401. Handles both Auth.js sessions and demo cookies.
 */
export async function getCurrentUserId(): Promise<string> {
  const session = await auth();
  if (session?.user?.id) return session.user.id;

  const jar = await cookies();
  const raw = jar.get(DEMO_COOKIE_NAME)?.value;
  if (raw) {
    const userId = verifyDemoCookie(raw);
    if (userId) return userId;
  }

  throw new Error("Not authenticated");
}
