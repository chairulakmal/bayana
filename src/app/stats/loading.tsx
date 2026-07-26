import { HomeLink } from "@/components/home-link";
import { BottomNav } from "@/components/bottom-nav";

// Loading skeleton for /stats. Mirrors `page.tsx`: header row, heading, the progress card,
// two tiles, the study CTA. Same rule as the hub's skeleton — anything that needs no data
// (the back link, the heading, the nav) is rendered for real, and only the numbers are
// placeholders. Here that means the page's structure and all of its wording arrive
// instantly, and only the figures fade in, which is the honest shape of what is actually
// being waited on: three counts from one query.

export default function StatsLoading() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col px-5 py-8 pb-24">
      {/* Header: real back link, then placeholders for the level chip and avatar, both of
          which do need the user record. */}
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
        Your progress
      </h1>

      {/* Progress card */}
      <section
        className="mt-6 rounded-[var(--r-lg)] p-5"
        style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow)" }}
        aria-hidden
      >
        <div className="flex items-baseline justify-between">
          <span className="text-[13px]" style={{ color: "var(--ink-soft)" }}>
            Words started
          </span>
          <div className="skel h-[13px] w-8" />
        </div>
        <div className="skel mt-2 h-[24px] w-32" />
        {/* Unfilled track, as on the hub: the empty state of a real bar, not a fake one. */}
        <div className="mt-3 h-2.5 w-full rounded-full" style={{ background: "var(--cream-100)" }} />
        <div className="skel mt-3 h-[12px] w-48" />
      </section>

      {/* Two tiles: label is static in the real page, so only the value and hint are stubs. */}
      <section className="mt-4 grid grid-cols-2 gap-4">
        <LoadingTile label="Due now" />
        <LoadingTile label="Recall rate" />
      </section>

      <div className="skel mt-8 h-[50px] w-full rounded-[var(--r-md)]" aria-hidden />

      <BottomNav />

      <span className="sr-only" role="status" aria-live="polite">
        Loading your progress
      </span>
    </main>
  );
}

/** Skeleton twin of the `Tile` in page.tsx — same surface, same rhythm, numbers pending. */
function LoadingTile({ label }: { label: string }) {
  return (
    <div
      className="rounded-[var(--r-lg)] p-5"
      style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow)" }}
    >
      <p className="text-[13px]" style={{ color: "var(--ink-soft)" }}>
        {label}
      </p>
      <div className="skel mt-2 h-[30px] w-16" aria-hidden />
      <div className="skel mt-2 h-[12px] w-20" aria-hidden />
    </div>
  );
}
