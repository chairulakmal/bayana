// Per-user profile helpers (server-only).
//
// Everything here reads through one memoized primitive, `getProfile`. Before that
// existed each helper issued its own `findUnique` for the same row, so a `/home` render
// fetched one `UserProfile` three times and each grammar route fetched it twice. See
// `getProfile` for why `cache()` is the right scope for this.

import { cache } from "react";
import { defaultDeps, type Deps } from "@/lib/deps";
import { Level } from "@/generated/prisma/enums";
import type { UserProfile } from "@/generated/prisma/client";

/**
 * The user's profile row, or null if they have no row yet (it is created lazily).
 *
 * Wrapped in React's `cache()`, which memoizes the call **for the duration of a single
 * request** and keys on the argument. Every helper below, plus the FSRS services in
 * `review.ts` / `grammar-review.ts`, funnels through it, so `/home` now costs one query
 * where it cost three (`hasOnboarded`, `getActiveLevel`, `getNewCardsPerDay`), and the
 * three grammar routes one where they cost two.
 *
 * The saving is deliberately modest today. The larger one arrives when a session's
 * initial payload is fetched during the page render instead of from a second request:
 * `getActiveLevel` and `getStudyQueue` then share a request, and the queue builder's own
 * profile read (the heaviest path in the app) becomes free. Landing the memoization
 * first is what makes that change a pure win rather than a fourth duplicate read.
 *
 * Why `cache()` and not the `use cache` directive: `use cache` is gated behind Next.js's
 * `cacheComponents` flag, which this project declined (SPEC §14.17). `cache()` is stable
 * React 19 API and needs no flag. It is also the *correct* scope rather than a lesser
 * one: a profile edit must be visible on the very next navigation, so a cache that
 * outlived the request would be a bug, not an optimization.
 *
 * Safe to call from anywhere. Verified against React 19.2.4: outside a request scope
 * (a route handler with no render, a script, a test) `cache()` does not throw, it simply
 * passes through and calls the function. The behaviour therefore degrades to exactly
 * what this code did before, and can never serve a stale row across requests.
 *
 * Note this fetches the whole row where the helpers below used to select one column
 * each. That is deliberate: one memoized entry can only have one shape, and a dozen
 * scalars from a single row keyed on a unique index is far cheaper than the three extra
 * round trips the narrow selects were costing.
 *
 * **The one hazard, for whoever touches a write path next.** Memoization is per request,
 * and a Server Action plus the re-render it triggers can be one request. So if a writer
 * ever calls this *before* updating the row, the render that follows may be handed the
 * pre-write value. No writer does today, which is why this is safe: `setActiveLevel` and
 * `completeOnboarding` both go straight from `getCurrentUserId()` to an `upsert` without
 * reading, and the two login routes create the row and redirect (a fresh request, hence a
 * fresh cache). Adding a read-before-write (the obvious shape of a "skip the update if
 * unchanged" optimization) is what would break it.
 *
 * `deps` is the database seam (see `lib/deps.ts`). It is a *keyed* argument as far as
 * `cache()` is concerned, so callers must not construct a fresh object per call — production
 * passes the module-level `defaultDeps`, and a test passes one fake for the whole test.
 */
export const getProfile = cache(
  async (userId: string, deps: Deps = defaultDeps): Promise<UserProfile | null> =>
    deps.db.userProfile.findUnique({ where: { userId } }),
);

/**
 * The subset of the profile the FSRS services need: scheduler tuning plus the new-card
 * pace. Shaped to satisfy `schedulerFor` (`Pick<UserProfile, "desiredRetention" |
 * "fsrsParams">`) with `newCardsPerDay` added for the queue builders.
 */
export type StudySettings = Pick<
  UserProfile,
  "desiredRetention" | "fsrsParams" | "newCardsPerDay"
>;

/**
 * Fallbacks for a user who has no `UserProfile` row yet (e.g. reaching study before
 * onboarding completes). These mirror the schema defaults, so behaviour is identical to
 * a freshly-created row rather than merely similar.
 *
 * This used to be a `DEFAULT_PROFILE` const duplicated byte-for-byte in `review.ts` and
 * `grammar-review.ts`. Two copies of a fallback is how vocab and grammar quietly end up
 * scheduling against different defaults.
 */
const DEFAULT_STUDY_SETTINGS: StudySettings = {
  desiredRetention: 0.9,
  fsrsParams: [],
  newCardsPerDay: 10,
};

/**
 * Study settings for a user, falling back to the schema defaults when no row exists.
 * The FSRS services call this rather than reading the profile themselves, which is what
 * keeps the whole request on one query.
 */
export async function getStudySettings(
  userId: string,
  deps: Deps = defaultDeps,
): Promise<StudySettings> {
  return (await getProfile(userId, deps)) ?? DEFAULT_STUDY_SETTINGS;
}

/**
 * The JLPT level both study modes operate on (SPEC §8.5). Falls back to N5 — the gentlest
 * starting point — until the user picks a level on the home hub. Read by `/study` and
 * `/quiz` so each session is scoped to one level.
 */
export async function getActiveLevel(
  userId: string,
  deps: Deps = defaultDeps,
): Promise<Level> {
  return (await getProfile(userId, deps))?.activeLevel ?? Level.N5;
}

/**
 * True once the user has completed first-run onboarding (chosen their starting level).
 * `onboardedAt` is null for a brand-new account. Used to gate the home hub redirect.
 */
export async function hasOnboarded(
  userId: string,
  deps: Deps = defaultDeps,
): Promise<boolean> {
  return !!(await getProfile(userId, deps))?.onboardedAt;
}

/**
 * The user's daily new-card cap (`UserProfile.newCardsPerDay`). Surfaced on the home hub
 * next to an explanation of the "ten words a day" pace. Falls back to the schema default
 * (10) if the profile is somehow missing.
 */
export async function getNewCardsPerDay(
  userId: string,
  deps: Deps = defaultDeps,
): Promise<number> {
  return (
    (await getProfile(userId, deps))?.newCardsPerDay ?? DEFAULT_STUDY_SETTINGS.newCardsPerDay
  );
}
