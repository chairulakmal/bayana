import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentUserId } from "@/lib/current-user";
import { getActiveLevel } from "@/lib/profile";
import { QuizSession } from "@/components/quiz-session";
import { Level } from "@/generated/prisma/enums";

// Quiz mode page (protected). Defaults to the user's active level (§8.5); `?level=`
// still overrides it (handy for testing a specific level).
export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  const userId = await getCurrentUserId();
  const { level } = await searchParams;
  const lvl = level && level in Level ? level : await getActiveLevel(userId);
  return <QuizSession level={lvl} />;
}
