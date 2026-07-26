"use server";

// Server actions for the home hub (SPEC §8.5). Marked "use server", so every export here
// is a server action callable from client components — keep them auth-checked and
// input-validated, since the client is untrusted.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { signOut } from "@/auth";
import { getCurrentUserId } from "@/lib/current-user";
import { DEMO_COOKIE_NAME } from "@/lib/current-user";
import { db } from "@/lib/db";
import { Level } from "@/generated/prisma/enums";

/**
 * Sign the current user out. Clears the database session and redirects to the
 * public landing page. Called via a <form action={signOutAction}> in UserMenu so
 * the session is destroyed server-side before any redirect happens.
 */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}

/**
 * End a demo session. Deletes the demo cookie (no DB Session row to clear) and
 * redirects to the public landing page. Called from UserMenu when `isDemo` is true.
 *
 * Lands on `/`, not `/auth/signin`, for two reasons: it matches where `signOutAction`
 * sends a real user (one exit, one destination), and the landing page offers both doors
 * (restart the demo, or sign in) whereas the sign-in form is a dead end for a visitor
 * without an invite — Bayana is allowlisted to a single address (SPEC §11.2).
 *
 * The cookie deletion is committed on this response, so the follow-up GET of `/` arrives
 * without it and `getOptionalUser()` renders the landing instead of bouncing to /home.
 */
export async function demoSignOutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(DEMO_COOKIE_NAME);
  redirect("/");
}

/** Persist the user's active JLPT level (the level both modes operate on).
 *
 *  Deliberately does not read the profile before writing it. `getProfile` memoizes per
 *  request and an action plus the re-render it triggers can be one request, so a read
 *  here would seed the cache with the pre-write row and the revalidated render below
 *  could then describe the *previous* level. See the hazard note in `lib/profile.ts`. */
export async function setActiveLevel(level: Level): Promise<void> {
  const userId = await getCurrentUserId(); // throws → action errors if unauthenticated
  // Object.hasOwn, not `in`: the arg is untrusted (server action), and `in` would accept
  // prototype keys like "constructor".
  if (!Object.hasOwn(Level, level)) throw new Error(`Invalid level: ${String(level)}`);
  // upsert: a new user may not have a UserProfile row yet (it's created lazily).
  await db.userProfile.upsert({
    where: { userId },
    update: { activeLevel: level },
    create: { userId, activeLevel: level },
  });
  // Every page that reads `activeLevel`, not just the one the picker used to live on. The
  // picker is now mounted on /grammar as well, and /grammar, /grammar/browse and /stats are
  // all level-scoped, so omitting them left a cached render describing the previous level.
  for (const path of ["/home", "/browse", "/stats", "/grammar", "/grammar/browse"]) {
    revalidatePath(path);
  }
}
