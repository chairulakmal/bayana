import { requireAuth } from "@/lib/current-user";
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
  const { userId } = await requireAuth();
  const { level } = await searchParams;
  // Object.hasOwn, not `in`: `in` accepts prototype keys ("constructor", …); we only want
  // real enum members before trusting the URL param over the user's stored level.
  const lvl = level && Object.hasOwn(Level, level) ? level : await getActiveLevel(userId);
  return <QuizSession level={lvl} />;
}
