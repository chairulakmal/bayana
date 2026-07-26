// /grammar/study — Grammar study session page shell.
//
// Mirrors /study, /quiz and /exam: the session's first payload is built HERE, during the page
// render, and handed to the client as a prop (§8.1). See `app/study/page.tsx` for the full note
// on which awaits belong in the page body and which must sit below the `<Suspense>` boundary,
// because getting that wrong is silent: the page still works, it just never streams.
//
// This route has one await the others do not: `hasOnboarded`. It stays in the page body with the
// auth guard, because it is a guard too: a redirect must be decided before anything renders, and
// streaming a session shell to a user who is about to be sent to /onboarding would paint a screen
// that is then thrown away. It is also free in practice, since `getProfile` memoizes the profile
// row per request and `getActiveLevel` needs the same row (§14.17).

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/current-user";
import { getActiveLevel, hasOnboarded } from "@/lib/profile";
import { buildGrammarSession } from "@/lib/grammar-cards";
import { GrammarSession } from "@/components/grammar-session";
import { SessionLoading } from "@/components/session-loading";

export const metadata = { title: "Grammar study" };

export default async function GrammarStudyPage() {
  const { userId } = await requireAuth();
  if (!(await hasOnboarded(userId))) redirect("/onboarding");

  const level = await getActiveLevel(userId);

  return (
    <Suspense fallback={<SessionLoading />}>
      <GrammarQueue userId={userId} level={level} />
    </Suspense>
  );
}

/**
 * The part of the page that waits on the database. It exists as its own component purely so that
 * its `await` happens below the `<Suspense>` boundary: a separate component is what makes it a
 * separate unit of streaming. Not exported, because nothing else should render a grammar queue.
 */
async function GrammarQueue({ userId, level }: { userId: string; level: string }) {
  const initial = await buildGrammarSession(userId, { level });
  return <GrammarSession level={level} initial={initial} />;
}
