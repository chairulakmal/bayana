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
 * Redirects to /quiz so the user's first action is playing, not reading.
 */
export async function completeOnboarding(level: Level): Promise<void> {
  const userId = await getCurrentUserId();
  if (!(level in Level)) throw new Error(`Invalid level: ${String(level)}`);
  await db.userProfile.upsert({
    where: { userId },
    update: { activeLevel: level, onboardedAt: new Date() },
    create: { userId, activeLevel: level, onboardedAt: new Date() },
  });
  redirect("/quiz");
}
