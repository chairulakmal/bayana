// Deletion of abandoned demo accounts — the code behind the retention promise the privacy
// policy makes (SPEC §11.8, §12).
//
// This used to live inside `POST /api/demo/login`, and moving it here is not tidying: it is
// what makes the promise keepable. Cleanup that only ran on a new demo login could not
// promise anything, because on a quiet week nothing ran at all and rows sat indefinitely.
// A page that says "deleted within 14 days" has to be backed by something that runs whether
// or not anybody visits, so the sweep is now callable from two places:
//
//   1. `scripts/cleanup-demo-users.ts`, run on a schedule (see that file for the Railway
//      cron setup). This is the one that makes the promise true.
//   2. The demo-login route, still, opportunistically. Redundant with the schedule and kept
//      anyway: it costs one indexed DELETE on a path that already writes, and it means a
//      misconfigured or paused cron degrades the promise rather than voiding it.
//
// **The stated window is 14 days, the enforced cutoff is 7.** That gap is deliberate. Rows
// become deletable at the cookie TTL, so a daily sweep removes them on day 7 or 8; promising
// 14 leaves room for a missed run, a paused service, or a deploy window without turning an
// operational hiccup into a broken commitment. Do not narrow the promise to 7 without also
// making the schedule itself a guaranteed thing.

import { db } from "@/lib/db";
import { DEMO_COOKIE_TTL_MS } from "@/lib/current-user";

/** What a sweep did, so a scheduled run can log something more useful than "ok". */
export type DemoCleanupResult = {
  /** Number of demo `User` rows deleted; their study data cascades with them. */
  deleted: number;
  /** The `createdAt` cutoff used, for the log line. */
  cutoff: Date;
};

/**
 * Deletes demo users whose cookies have certainly expired.
 *
 * The filter is narrow on purpose — a wrong match cascade-deletes real study progress, since
 * every relation is `onDelete: Cascade` — and each condition independently removes a class of
 * non-demo user:
 *
 *   - `email: null` — demo users never get an email; magic-link users always do.
 *   - `sessions: none` — demo sessions are cookie-only; any user with an Auth.js `Session`
 *     row signed in for real.
 *   - `createdAt < now − TTL` — older than the longest a demo cookie can live, so the rows
 *     are provably unreachable: the signed expiry inside the cookie has passed and
 *     `verifyDemoCookie` would reject it even if the browser still held it.
 *   - `id ≠ DEFAULT_USER_ID` — the seed script (`scripts/seed-user.ts`) can leave a
 *     null-email user when `AUTH_ALLOWED_EMAIL` is unset; never touch it.
 *
 * Why a heuristic rather than an `isDemo` column: SPEC §14.5. The short version is that the
 * property is fully derivable and a column would need a migration and a backfill.
 *
 * @returns how many rows went, and the cutoff used.
 */
export async function deleteStaleDemoUsers(): Promise<DemoCleanupResult> {
  const cutoff = new Date(Date.now() - DEMO_COOKIE_TTL_MS);
  // Empty string (the blank placeholder in .env) is treated as "not set".
  const pinnedId = process.env.DEFAULT_USER_ID || undefined;

  const { count } = await db.user.deleteMany({
    where: {
      email: null,
      createdAt: { lt: cutoff },
      sessions: { none: {} },
      ...(pinnedId ? { id: { not: pinnedId } } : {}),
    },
  });

  return { deleted: count, cutoff };
}
