"use server";

// Server actions for the home hub (SPEC §8.5). Marked "use server", so every export here
// is a server action callable from client components — keep them auth-checked and
// input-validated, since the client is untrusted.
import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/current-user";
import { db } from "@/lib/db";
import { Level } from "@/generated/prisma/enums";

/** Persist the user's active JLPT level (the level both modes operate on). */
export async function setActiveLevel(level: Level): Promise<void> {
  const userId = await getCurrentUserId(); // throws → action errors if unauthenticated
  if (!(level in Level)) throw new Error(`Invalid level: ${String(level)}`);
  await db.userProfile.update({ where: { userId }, data: { activeLevel: level } });
  revalidatePath("/home");
}
