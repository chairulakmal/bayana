"use client";

// The error screen every study mode shows when its first payload fails to build.
//
// `"use client"` because React error boundaries are a client-side mechanism, exactly as in
// the root `error.tsx`. Each route still needs its own `error.tsx` file (a boundary is
// per-segment and cannot be shared by importing it somewhere else), but those files are now
// thin wrappers that supply copy, and the reasoning below lives here once.
//
// **Why the four session routes need a boundary at all.** This moved from optional to
// required when the session payloads moved onto the server. While the first fetch happened in
// a `useEffect`, a failure was caught inside the session component and rendered its own retry
// screen; now the fetch happens during the page render, so a failure throws. Without a
// boundary in that segment it escapes to the root one, which is written for the whole app: it
// offers "Back to start" and knows nothing about studying, so the user loses the session
// framing and lands somewhere that cannot resume what they were doing.
//
// **The in-component retry screens have not gone away and are not duplicated here.** The two
// tiers cover different failures, which is the distinction worth keeping straight: this one
// catches the *initial* server-side build, while the component's own screen catches an
// imperative *refetch* ("Check for more", "Play again", retry) from a session that is already
// on screen and may still hold its cards.
//
// **`message` is a required prop rather than a shared default**, which is the one piece of
// copy worth spending a prop on. Each mode can promise something different and true: a
// flashcard queue build only reads, so progress is provably safe, whereas a sentence saying so
// on `/quiz` would be making a claim about a mode whose write behaviour changes in Phase 3.
// A generic reassurance would either be vague enough to be worthless or specific enough to go
// stale somewhere.

import { useEffect } from "react";
import Link from "next/link";
import { Parrot } from "@/components/parrot";

export function SessionError({
  error,
  reset,
  title,
  message,
  homeHref,
  homeLabel,
  logLabel,
}: {
  // Next.js replaces a server error's message with a generic one before it reaches the
  // browser and gives us this hash instead, which is the join key to the server log.
  error: Error & { digest?: string };
  // Re-runs the failed segment render without a full page load. Worth offering first in every
  // mode: the likely causes are a dropped database connection or a cold start, and re-running
  // the build is both cheaper and less disorienting than navigating away from studying.
  reset: () => void;
  /** Headline. Names what failed in the user's terms ("your cards", "the quiz"). */
  title: string;
  /** One line of reassurance that must be *true of this mode*; see the header note. */
  message: string;
  /** Where the secondary button goes. `/grammar` for the grammar queue, `/home` otherwise. */
  homeHref: string;
  /** Label for that button, since "Home" is wrong when the target is the grammar hub. */
  homeLabel: string;
  /** Prefix for the console line, so the server log names the route that threw. */
  logLabel: string;
}) {
  useEffect(() => {
    console.error(`${logLabel} route error boundary caught an error:`, error);
  }, [error, logLabel]);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 text-center pt-safe pb-safe">
      {/* Sleepy, not startled: BRAND.md §2 assigns this mood to a failed load, and the root
          boundary's "wow" is for the app-wide surprise rather than a payload that would not
          build. */}
      <Parrot expr="sleepy" title="Pī looking concerned" style={{ width: 124, height: 138 }} />

      <h1 className="mt-4 text-2xl" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
        {title}
      </h1>
      {/* BRAND.md §1: the failure is ours and the copy says so. */}
      <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
        {message}
      </p>

      <div className="mt-6 flex gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">
          Try again
        </button>
        {/* Never `/`, unlike the root boundary: reaching any of these screens required a
            session, so there is no signed-out visitor to route around here. */}
        <Link href={homeHref} className="btn btn-ghost">
          {homeLabel}
        </Link>
      </div>

      {error.digest && (
        <p className="mt-5 text-[11px]" style={{ color: "var(--ink-faint)" }}>
          Reference: <code>{error.digest}</code>
        </p>
      )}
    </main>
  );
}
