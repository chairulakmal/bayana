import { requireAuth } from "@/lib/current-user";
import { getActiveLevel } from "@/lib/profile";
import { StudySession } from "@/components/study-session";

// Flashcard mode, scoped to the user's active level (§8.5). `requireAuth` handles both
// real sessions and demo cookies, and redirects to sign-in if neither is present.
export default async function StudyPage() {
  const { userId } = await requireAuth();
  const level = await getActiveLevel(userId);
  return <StudySession level={level} />;
}
