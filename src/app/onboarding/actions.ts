"use server";

// First-run onboarding action. Called once, when a new user picks their starting level.
// Sets onboardedAt so the home hub knows not to redirect here again.

import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/current-user";
import { db } from "@/lib/db";
import { Level } from "@/generated/prisma/enums";

/**
 * Persist the chosen starting level and mark the account as onboarded.
 * Upserts so it's idempotent — safe if called twice (e.g. double-tap).
 *
 * Redirects to the home hub, which is now the app's default page: it shows what's due and
 * offers all four modes, so a brand-new user sees the whole app rather than being dropped
 * straight into one mode. (This previously sent people to `/quiz`, a leftover from before
 * the hub had any status of its own. The effect was that a first-time user never saw the
 * hub at all.)
 */
export async function completeOnboarding(level: Level): Promise<void> {
  const userId = await getCurrentUserId();
  // Object.hasOwn, not `in`: the arg is untrusted (server action), and `in` would accept
  // prototype keys like "constructor".
  if (!Object.hasOwn(Level, level)) throw new Error(`Invalid level: ${String(level)}`);
  await db.userProfile.upsert({
    where: { userId },
    update: { activeLevel: level, onboardedAt: new Date() },
    create: { userId, activeLevel: level, onboardedAt: new Date() },
  });
  redirect("/home");
}
