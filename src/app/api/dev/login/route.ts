// DEV-ONLY auth bypass — GET /api/dev/login
//
// Mints a *real* database session for the seeded/allowlisted user and sets its cookie, so
// local development skips the magic-link round-trip. Because it produces a genuine session,
// everything downstream (`proxy.ts`, `auth()`, `getCurrentUserId`) works unchanged — full
// parity with the production flow, no special-casing sprinkled around.
//
// SECURITY (SPEC §11.7): this route is HARD-DISABLED in production and unless `DEV_AUTH=1`,
// so it cannot exist in the deployed app:
//   - returns 404 when `NODE_ENV === "production"` (the env flag is never set there), and
//   - returns 404 unless `DEV_AUTH=1` is explicitly opted in (required outside prod too).
// We deliberately did NOT use an Auth.js Credentials provider: it requires the JWT session
// strategy, but Bayana uses database sessions (src/auth.ts).
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, matches src/auth.ts

/** The bypass is only live outside production AND when explicitly opted in. */
function devLoginEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEV_AUTH === "1";
}

export async function GET(request: Request) {
  if (!devLoginEnabled()) {
    // In prod, or without the explicit flag, the route simply does not exist.
    return new NextResponse("Not found", { status: 404 });
  }

  // Log in as the allowlisted/seeded user (case-insensitive, mirroring src/auth.ts).
  const email = process.env.AUTH_ALLOWED_EMAIL?.trim().toLowerCase();
  const user = email ? await db.user.findUnique({ where: { email } }) : null;
  if (!user) {
    return new NextResponse(
      "Dev login: no seeded user found for AUTH_ALLOWED_EMAIL. Run `npx tsx scripts/seed-user.ts` first.",
      { status: 500 },
    );
  }

  // Create a real DB session (the exact shape Auth.js's Prisma adapter uses) …
  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { sessionToken, userId: user.id, expires } });

  // … and set its cookie on the redirect response. Dev is http, so the non-secure cookie
  // name (`authjs.session-token`) is what `auth()` / proxy.ts expect.
  const res = NextResponse.redirect(new URL("/home", request.url));
  res.cookies.set("authjs.session-token", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
  });
  return res;
}
