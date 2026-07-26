import { Suspense } from "react";
import { requireAuth } from "@/lib/current-user";
import { getActiveLevel } from "@/lib/profile";
import { buildQuizRound } from "@/lib/quiz";
import { QuizSession } from "@/components/quiz-session";
import { SessionLoading } from "@/components/session-loading";
import { Level } from "@/generated/prisma/enums";

export const metadata = { title: "Quiz" };

// Quiz mode page (protected). Defaults to the user's active level (§8.5); `?level=`
// still overrides it (handy for testing a specific level).
//
// The round's first payload is built HERE, during the page render, and handed to the client as a
// prop, following the `/study` reference (§8.1). Before this, the page resolved an auth cookie
// and a five-character level string and stopped: the client then mounted, painted a spinner, and
// issued a second request that re-derived `userId` from scratch.
//
// **Which awaits sit where is the whole design of this file**, and getting it wrong is silent, since
// the page still works and merely stops streaming:
//
//   - `requireAuth()` belongs in the page body. It is the guard, so nothing may render before it
//     resolves. It reads a cookie and does not touch the database.
//   - `searchParams` and `getActiveLevel()` also belong here: the level must be resolved before
//     the child can be constructed, and neither is expensive (the profile read is memoized per
//     request by `getProfile`, §14.17).
//   - `buildQuizRound()` deliberately does **not**. `<Suspense>` streams only what is *below*
//     the boundary, so awaiting the round in this function would block the whole page on it and
//     the boundary would never get a chance to show its fallback.
//
// A failure in `buildQuizRound` now throws during a server render instead of being caught in a
// `useEffect`, which is why this route needs its own `error.tsx` beside it.
export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>;
}) {
  const { userId } = await requireAuth();
  const { level } = await searchParams;
  // Object.hasOwn, not `in`: `in` accepts prototype keys ("constructor", …); we only want
  // real enum members before trusting the URL param over the user's stored level.
  const lvl =
    level && Object.hasOwn(Level, level) ? (level as Level) : await getActiveLevel(userId);

  return (
    <Suspense fallback={<SessionLoading />}>
      <QuizRound level={lvl} />
    </Suspense>
  );
}

/**
 * The part of the page that waits on the database. It exists as its own component purely so that
 * its `await` happens below the `<Suspense>` boundary: a separate component is what makes it a
 * separate unit of streaming. Not exported, because nothing else should render a quiz round.
 */
async function QuizRound({ level }: { level: Level }) {
  const initial = await buildQuizRound(level);
  return <QuizSession level={level} initial={initial} />;
}
