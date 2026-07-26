import { HomeLink } from "@/components/home-link";
import { BottomNav } from "@/components/bottom-nav";
import { WordListSkeleton } from "@/components/word-list-skeleton";

// Loading skeleton for /browse. The page's own server work is small (auth + active level),
// so this fallback is usually brief — but it hands straight over to `BrowseClient`, which
// then fetches the level's entire word list. Both waits render `WordListSkeleton`, so the
// placeholder the user sees here is literally the same one that stays on screen through the
// longer client fetch. See that component for the reasoning.
//
// Everything static on the real page (back link, heading, instruction line, nav) is rendered
// for real; only the level chip, the avatar, and the list are pending.

export default function BrowseLoading() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col px-5 py-8 pb-24">
      <div className="relative flex h-9 items-center justify-center">
        <div className="absolute left-0">
          <HomeLink />
        </div>
        <div className="skel h-[26px] w-12 rounded-full" aria-hidden />
        <div className="absolute right-0">
          <div className="skel h-9 w-9 rounded-full" aria-hidden />
        </div>
      </div>

      <h1 className="mt-6 text-2xl" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
        Browse words
      </h1>

      <p className="mt-3 text-[13px]" style={{ color: "var(--ink-soft)" }}>
        Tap any word to see its example sentence.
      </p>

      <div className="mt-5">
        <WordListSkeleton />
      </div>

      <BottomNav />

      <span className="sr-only" role="status" aria-live="polite">
        Loading the word list
      </span>
    </main>
  );
}
