import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/current-user";
import { getActiveLevel, hasOnboarded } from "@/lib/profile";
import { buildGrammarBrowse } from "@/lib/grammar-browse";
import { GrammarBrowseClient } from "@/components/grammar-browse-client";
import { LessonListSkeleton } from "@/components/lesson-list-skeleton";
import { InlineErrorBoundary } from "@/components/inline-error-boundary";
import { UserMenu } from "@/components/user-menu";
import { BottomNav } from "@/components/bottom-nav";

// /grammar/browse — full grammar reference, all points and examples grouped by lesson.
// Mirrors /browse (vocab): whole-deck lookup for the active level, search by pattern,
// reading, or meaning. See lib/grammar-browse.ts for why sentences aren't lazy-loaded here the
// way vocab sentences are on /browse.
//
// **The lessons are built here, during the page render** (SPEC §9.3), following `/study` rather
// than `/browse`: at ~220 rows the payload is small enough that serializing it into the RSC
// response beats keeping the client's mount-then-fetch round trip. `/browse` went the other way
// for a reason that does not apply at this scale; its header comment has the comparison.
//
// The query sits below a `<Suspense>` boundary in a nested component, not in this function, and
// that placement is the design: `<Suspense>` streams only what is *below* it, so awaiting the
// lessons up here would block the whole page and the fallback would never paint. The header,
// heading and nav therefore arrive immediately while the accordion streams in behind them.
export const metadata = { title: "Browse grammar" };

export default async function GrammarBrowsePage() {
  const { userId, email, isDemo } = await requireAuth();
  if (!(await hasOnboarded(userId))) redirect("/onboarding");

  const level = await getActiveLevel(userId);
  const grammarLevel = level.toString();

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col px-5 py-8 pb-24">
      {/* Header: back link left, level chip centred, avatar right */}
      <div className="relative flex h-9 items-center justify-center">
        <div className="absolute left-0">
          <Link
            href="/grammar"
            className="inline-flex items-center gap-1 active:opacity-70"
            style={{
              fontFamily: "var(--f-display)",
              fontWeight: 600,
              fontSize: 13,
              padding: "4px 10px",
              borderRadius: 999,
              background: "var(--surface)",
              boxShadow: "inset 0 0 0 1.5px var(--pink-200), 0 2px 0 var(--line)",
              color: "var(--grape)",
            }}
          >
            <span aria-hidden style={{ color: "var(--ink-faint)" }}>←</span>
            <span>Grammar</span>
          </Link>
        </div>
        <span className={`chip chip-${grammarLevel.toLowerCase()}`}>{grammarLevel}</span>
        <div className="absolute right-0">
          <UserMenu email={email ?? ""} isDemo={isDemo} />
        </div>
      </div>

      <h1 className="mt-6 text-2xl" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
        Browse grammar
      </h1>

      <p className="mt-3 text-[13px]" style={{ color: "var(--ink-soft)" }}>
        Every grammar point and example, grouped by lesson.
      </p>

      {/* The boundary sits OUTSIDE `<Suspense>` and inside the page, which is the whole
          point: a failed query replaces the list and nothing else, leaving the header, the
          heading and the nav intact. Wrapping it the other way round would put the fallback
          where the skeleton goes but leave the boundary unable to catch a failure that
          happens before the suspense resolves. See `inline-error-boundary.tsx` for why this
          is not an `error.tsx`. */}
      <div className="mt-5">
        <InlineErrorBoundary
          title="Couldn't load the grammar points"
          message="That one is on us, not you. Nothing you have studied was affected."
        >
          <Suspense fallback={<LessonListSkeleton />}>
            <GrammarLessons userId={userId} level={grammarLevel} />
          </Suspense>
        </InlineErrorBoundary>
      </div>
      <BottomNav />
    </main>
  );
}

/**
 * The part of the page that waits on the database. It exists as its own component purely so that
 * its `await` happens below the `<Suspense>` boundary: a separate component is what makes it a
 * separate unit of streaming. Not exported, because nothing else should build this list.
 *
 * A failure here throws during a server render rather than landing in a `useEffect`'s catch, so
 * it surfaces through the nearest error boundary instead of the client's own "Couldn't load
 * grammar points" branch, which no longer exists. That nearest boundary is the page's own
 * `<InlineErrorBoundary>`, deliberately, so the failure stays inside the page.
 */
async function GrammarLessons({ userId, level }: { userId: string; level: string }) {
  const lessons = await buildGrammarBrowse(userId, level);
  return <GrammarBrowseClient lessons={lessons} />;
}
