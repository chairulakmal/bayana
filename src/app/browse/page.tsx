import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentUserId } from "@/lib/current-user";
import { getActiveLevel } from "@/lib/profile";
import { BrowseClient } from "@/components/browse-client";
import { BrowseLevelPicker } from "@/components/browse-level-picker";
import { HomeLink } from "@/components/home-link";
import { Level } from "@/generated/prisma/enums";

// Browse/search page (SPEC §13 Phase 2 light polish). Whole-deck lookup for the active
// level: search any word by kanji, reading, or meaning; tap to see its example sentence.
//
// The word list is fetched by the client (browser-cached per level). This server component
// only handles auth and resolves the current level. `key={lvl}` on BrowseClient forces a
// full remount when the level changes — resetting query, page, and open sentence — so the
// new level's word list loads cleanly without stale UI state from the previous level.
export const metadata = { title: "Browse" };

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  const userId = await getCurrentUserId();
  const { level } = await searchParams;
  const lvl = level && level in Level ? level : await getActiveLevel(userId);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col px-5 py-8">
      <div className="flex items-center justify-between">
        <HomeLink />
      </div>

      <h1
        className="mt-6 text-2xl"
        style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}
      >
        Browse words
      </h1>

      {/* Level switcher — compact chip row. Persists to UserProfile.activeLevel (global
          scope, same as home hub) and navigates to /browse without a ?level= param so the
          server always reads the DB value rather than a stale URL override. */}
      <div className="mt-3">
        <BrowseLevelPicker current={lvl} />
      </div>

      <p className="mt-3 text-[13px]" style={{ color: "var(--ink-soft)" }}>
        Tap any word to see its example sentence.
      </p>

      {/* key=lvl forces BrowseClient to remount when the level changes, resetting all
          client state (search query, current page, open sentence) cleanly. */}
      <div className="mt-5">
        <BrowseClient key={lvl} level={lvl} />
      </div>
    </main>
  );
}
