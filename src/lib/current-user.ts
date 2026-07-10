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
// Cookie format: `<cuid>:<expiresAtMs>:<hmac-sha256-hex>` — the HMAC (keyed by
// AUTH_SECRET) covers BOTH the userId and the expiry timestamp, so a user can
// neither forge a session for an arbitrary userId nor extend their own expiry.
// The server checks the timestamp on every request: the browser-side cookie
// `expires` attribute alone would make the 7-day lifetime purely cosmetic, since
// a captured cookie value could be replayed forever. Constant-time comparison
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

/**
 * Fails CLOSED when AUTH_SECRET is missing. The previous `?? ""` fallback meant a
 * misconfigured deploy would silently sign cookies with an empty (i.e. publicly
 * known) key, making every demo cookie forgeable for any userId. Throwing turns
 * that misconfiguration into a loud error instead of a silent auth bypass.
 */
function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set — cannot sign or verify demo cookies.");
  }
  return secret;
}

/** HMAC-SHA256 of the cookie payload keyed by AUTH_SECRET. 64-char hex string. */
function signDemoPayload(payload: string): string {
  return createHmac("sha256", getAuthSecret()).update(payload).digest("hex");
}

/**
 * Builds a demo cookie value binding `userId` to an absolute expiry time:
 * `userId:expiresAtMs:hmac`. The signature covers the whole payload, so the
 * expiry is tamper-proof. Pass the same instant to the cookie's `expires`
 * attribute so the browser-visible lifetime matches the server-enforced one.
 */
export function createDemoCookieValue(userId: string, expiresAtMs: number): string {
  const payload = `${userId}:${expiresAtMs}`;
  return `${payload}:${signDemoPayload(payload)}`;
}

/**
 * Parses and verifies a demo cookie value. Returns the userId on success, null
 * if the value is missing, malformed, expired, or the HMAC doesn't match.
 *
 * Uses `timingSafeEqual` to prevent timing-based attacks — never compare HMACs
 * with `===` or `!==`, which short-circuits on the first differing byte.
 *
 * Note: cookies in the pre-expiry format (`userId:hmac`) fail verification and
 * fall through to the sign-in redirect — acceptable for throwaway demo sessions.
 */
function verifyDemoCookie(value: string): string | null {
  // Split from the right: `userId:expiresAtMs:sig`. cuids contain no colons, so
  // the two rightmost separators are unambiguous.
  const sigIdx = value.lastIndexOf(":");
  if (sigIdx === -1) return null;
  const payload = value.slice(0, sigIdx); // "userId:expiresAtMs"
  const providedSig = value.slice(sigIdx + 1);
  const expIdx = payload.lastIndexOf(":");
  if (expIdx === -1) return null;
  const userId = payload.slice(0, expIdx);
  const expiresAtMs = Number(payload.slice(expIdx + 1));
  if (!userId || providedSig.length !== 64 || !Number.isFinite(expiresAtMs)) return null; // SHA-256 hex is always 64 chars

  // Verify authenticity first — an expiry check on an unverified payload would
  // let an attacker probe the parser with arbitrary input.
  const expectedSig = signDemoPayload(payload);
  try {
    const a = Buffer.from(providedSig, "hex");
    const b = Buffer.from(expectedSig, "hex");
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  // Server-side expiry: a replayed cookie value dies at the signed timestamp
  // even if the client ignores the cookie's own `expires` attribute.
  if (Date.now() > expiresAtMs) return null;
  return userId;
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
