"use server";

// Server actions for the home hub (SPEC §8.5). Marked "use server", so every export here
// is a server action callable from client components — keep them auth-checked and
// input-validated, since the client is untrusted.
import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";
import { getCurrentUserId } from "@/lib/current-user";
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

/** Persist the user's active JLPT level (the level both modes operate on). */
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
  revalidatePath("/home");
  revalidatePath("/browse"); // browse reads activeLevel too
}
