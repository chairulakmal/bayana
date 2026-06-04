// Per-user profile helpers (server-only).
import { db } from "@/lib/db";
import { Level } from "@/generated/prisma/enums";

/**
 * The JLPT level both study modes operate on (SPEC §8.5). Falls back to N5 — the gentlest
 * starting point — until the user picks a level on the home hub. Read by `/study` and
 * `/quiz` so each session is scoped to one level.
 */
export async function getActiveLevel(userId: string): Promise<Level> {
  const profile = await db.userProfile.findUnique({
    where: { userId },
    select: { activeLevel: true },
  });
  return profile?.activeLevel ?? Level.N5;
}
