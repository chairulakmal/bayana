import { requireAuth } from "@/lib/current-user";
import { getActiveLevel } from "@/lib/profile";
import { BrowseClient } from "@/components/browse-client";
import { HomeLink } from "@/components/home-link";
import { UserMenu } from "@/components/user-menu";
import { BottomNav } from "@/components/bottom-nav";

// Browse/search page (SPEC §13 Phase 2 light polish). Whole-deck lookup for the active
// level: search any word by kanji, reading, or meaning; tap to see its example sentence.
//
// The word list is fetched by the client (browser-cached per level). Level is read from
// UserProfile (set on the home hub) — no level switcher here to keep the page focused.
export const metadata = { title: "Browse" };

export default async function BrowsePage() {
  const { userId, email, isDemo } = await requireAuth();
  const level = await getActiveLevel(userId);

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
        <BrowseClient level={level} />
      </div>
      <BottomNav />
    </main>
  );
}
