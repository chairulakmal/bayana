import { requireAuth } from "@/lib/current-user";
import { getActiveLevel } from "@/lib/profile";
import { ExamSession } from "@/components/exam-session";
import { Level } from "@/generated/prisma/enums";

// Exam mode page (protected). Defaults to the user's active level; `?level=` overrides
// it (handy for testing a specific level without changing the stored preference).
export default async function ExamPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>;
}) {
  const { userId } = await requireAuth();
  const { level } = await searchParams;
  const lvl = level && Object.hasOwn(Level, level) ? level : await getActiveLevel(userId);
  return <ExamSession level={lvl} />;
}
