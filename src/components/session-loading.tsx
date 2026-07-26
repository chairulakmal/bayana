// The wait a study mode shows while its first payload is still being built.
//
// This was `study-session.tsx`'s `cards === null` branch, which the component rendered after
// mounting and kicking off its own fetch. Now that the first payload is built during the page
// render, it is a `<Suspense>` fallback instead, and it moved out of the component for a
// structural reason rather than a tidiness one: the component no longer *has* a
// "no cards yet" state, because it is handed its cards as a prop.
//
// Sleepy Pī, per BRAND.md §2, which deliberately assigns that one mood to loading, empty and
// failed alike: there is no sad Pī, and the copy beside it carries the distinction.

import { Parrot } from "@/components/parrot";

export function SessionLoading() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 text-center pt-safe pb-safe">
      <Parrot expr="sleepy" style={{ width: 84, height: 94 }} />
      <p className="mt-3" style={{ color: "var(--ink-soft)" }}>
        Loading…
      </p>
      {/* A mascot and an ellipsis are invisible to a screen reader, so the wait gets a polite
          live region, matching the route-level loading files (SPEC §8.4). It is safe to mount
          it with its content here, unlike the in-session regions: this whole subtree appears
          at once and is replaced wholesale, so there is no later content change to miss. */}
      <span className="sr-only" role="status" aria-live="polite">
        Loading your study queue
      </span>
    </main>
  );
}
