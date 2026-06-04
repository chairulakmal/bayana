import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentUserId } from "@/lib/current-user";
import { getActiveLevel } from "@/lib/profile";
import { StudySession } from "@/components/study-session";

// The study app — Anki mode, scoped to the user's active level (§8.5). Server-side auth
// gate: unauthenticated visitors go to sign-in (also catches expired sessions the
// cookie-only proxy guard would let through). The home hub lives at `/home`.
export default async function StudyPage() {
  const session = await auth();
  if (!session) redirect("/auth/signin");
  const userId = await getCurrentUserId();
  const level = await getActiveLevel(userId);
  return <StudySession level={level} />;
}
