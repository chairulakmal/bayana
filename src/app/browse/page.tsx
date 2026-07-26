import { requireAuth } from "@/lib/current-user";
import { getActiveLevel } from "@/lib/profile";
import { getStartedWordIds } from "@/lib/browse";
import { BrowseClient } from "@/components/browse-client";
import { HomeLink } from "@/components/home-link";
import { UserMenu } from "@/components/user-menu";
import { BottomNav } from "@/components/bottom-nav";

// Browse/search page (SPEC §13 Phase 2 light polish). Whole-deck lookup for the active
// level: search any word by kanji, reading, or meaning; tap to see its example sentence.
//
// **This page is the exception to the "server-render the data" convention** the four session
// screens follow (SPEC §9.3), and the reason is payload size. A session is ~20 cards; this is
// the entire level, ~2,700 rows and ~90 KB gzipped for N1, and it has to be whole because
// search filters in memory. Serialized into the RSC payload it would be re-downloaded on every
// visit, since a dynamic (cookie-reading) route's response is not cacheable. So the list stays
// a client fetch of `/api/browse`, where a real HTTP cache can hold it for a day.
//
// What the page *does* render is the per-user half: the ids of words already in the user's
// deck. That is what used to make the big response user-specific and uncacheable (see
// `lib/browse.ts`). It is one indexed query returning a few hundred ids, so it sits in the page
// body rather than below a `<Suspense>` boundary the way `/study` puts its queue build: the
// route's `loading.tsx` already covers a wait this short, and splitting it would buy nothing.
//
// Level is read from UserProfile (set on the home hub) — no level switcher here to keep the
// page focused.
export const metadata = { title: "Browse" };

export default async function BrowsePage() {
  const { userId, email, isDemo } = await requireAuth();
  const level = await getActiveLevel(userId);
  const started = await getStartedWordIds(userId, level);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col px-5 py-8 pb-24">
      {/* Header: back link left, level chip centred, avatar right */}
      <div className="relative flex h-9 items-center justify-center">
        <div className="absolute left-0"><HomeLink /></div>
        <span className={`chip chip-${level.toLowerCase()}`}>{level}</span>
        <div className="absolute right-0"><UserMenu email={email ?? ""} isDemo={isDemo} /></div>
      </div>

      <h1
        className="mt-6 text-2xl"
        style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}
      >
        Browse words
      </h1>

      <p className="mt-3 text-[13px]" style={{ color: "var(--ink-soft)" }}>
        Tap any word to see its example sentence.
      </p>

      <div className="mt-5">
        <BrowseClient level={level} started={started} />
      </div>
      <BottomNav />
    </main>
  );
}
