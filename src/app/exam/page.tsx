import { Suspense } from "react";
import { requireAuth } from "@/lib/current-user";
import { getActiveLevel } from "@/lib/profile";
import { buildExamRound } from "@/lib/exam";
import { ExamSession } from "@/components/exam-session";
import { SessionLoading } from "@/components/session-loading";
import { Level } from "@/generated/prisma/enums";

export const metadata = { title: "Exam" };

// Exam mode page (protected). Defaults to the user's active level; `?level=` overrides
// it (handy for testing a specific level without changing the stored preference).
//
// The round is built during this render and handed to the client as a prop, following the
// `/study` reference (§8.1). See `app/quiz/page.tsx` for the full note on which awaits belong in
// the page body and which must sit below the `<Suspense>` boundary; the division here is the
// same, with `buildExamRound` as the one call that streams.
export default async function ExamPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>;
}) {
  const { userId } = await requireAuth();
  const { level } = await searchParams;
  const lvl =
    level && Object.hasOwn(Level, level) ? (level as Level) : await getActiveLevel(userId);

  return (
    <Suspense fallback={<SessionLoading />}>
      <ExamRound level={lvl} />
    </Suspense>
  );
}

/**
 * The part of the page that waits on the database, split out so its `await` lands below the
 * `<Suspense>` boundary. `buildExamRound` takes a single total and owns the 問題１/問題２ split,
 * which is what keeps this page and `GET /api/exam` from handing the component two differently
 * divided rounds (see that function's doc for why the component would not notice).
 */
async function ExamRound({ level }: { level: Level }) {
  const initial = await buildExamRound(level);
  return <ExamSession level={level} initial={initial} />;
}
