import { Suspense } from "react";
import { requireAuth } from "@/lib/current-user";
import { getActiveLevel } from "@/lib/profile";
import { buildSession } from "@/lib/study-cards";
import { StudySession } from "@/components/study-session";
import { SessionLoading } from "@/components/session-loading";

export const metadata = { title: "Flashcards" };

// Flashcard mode, scoped to the user's active level (§8.5).
//
// The session's first payload is built HERE, during the page render, and handed to the client
// as a prop. Before this, the page resolved an auth cookie plus a five-character level string
// and stopped: the client then mounted, painted a spinner, and issued a second request that
// re-derived `userId` from scratch. So reaching a card cost a server round trip, a JS parse,
// and another server round trip. It also made `<Link>` prefetching worthless, because
// prefetching `/study` warmed up a spinner rather than a queue.
//
// **Which awaits sit where is the whole design of this file**, and getting it wrong is silent:
//
//   - `requireAuth()` belongs in the page body. It is the guard, so nothing may render before
//     it resolves. It reads a cookie and does not touch the database.
//   - `getActiveLevel()` also belongs here: one indexed read of a `UserProfile` row that
//     `getProfile` memoizes per request (§14.17), and both the fallback and the child need
//     the level to render their chrome.
//   - `buildSession()` deliberately does **not**. `<Suspense>` streams only what is *below*
//     the boundary, so awaiting the queue in this function would block the entire page on it
//     and the boundary would never get a chance to show its fallback. Moving that one await
//     into a nested async component is what makes the shell paint immediately.
//
// A failure in `buildSession` now throws during a server render instead of being caught in a
// `useEffect`, which is why this route needs its own `error.tsx` beside it (see that file).
export default async function StudyPage() {
  const { userId } = await requireAuth();
  const level = await getActiveLevel(userId);

  return (
    <Suspense fallback={<SessionLoading />}>
      <StudyQueue userId={userId} level={level} />
    </Suspense>
  );
}

/**
 * The part of the page that waits on the database. It exists as its own component purely so
 * that its `await` happens below the `<Suspense>` boundary: a separate component is what makes
 * it a separate unit of streaming. Not exported, because nothing else should render a queue.
 */
async function StudyQueue({ userId, level }: { userId: string; level: Awaited<ReturnType<typeof getActiveLevel>> }) {
  const initial = await buildSession(userId, { level });
  return <StudySession level={level} initial={initial} />;
}
