"use client";

// Error boundary for `/study` only. `"use client"` because React error boundaries are a
// client-side mechanism, exactly as in the root `error.tsx`.
//
// This file moved from optional to required when the queue moved onto the server. While the
// first fetch happened in a `useEffect`, a failure was caught inside `study-session.tsx` and
// rendered its own retry screen; now the fetch happens during the page render, so a failure
// throws. Without a boundary in this segment it escapes to the root one, which is written for
// the whole app: it offers "Back to start" and knows nothing about study, so the user loses the
// session framing and lands somewhere that cannot resume what they were doing.
//
// The in-component retry screen in `study-session.tsx` has not gone away and is not duplicated
// here. The two cover different failures, which is the distinction worth keeping straight:
// this one catches the *initial* server-side build, that one catches an imperative *refetch*
// from a session that is already on screen and still holds its cards.

import { useEffect } from "react";
import Link from "next/link";
import { Parrot } from "@/components/parrot";

export default function StudyError({
  error,
  reset,
}: {
  // Next.js replaces a server error's message with a generic one before it reaches the
  // browser and gives us this hash instead, which is the join key to the server log.
  error: Error & { digest?: string };
  // Re-runs the failed segment render without a full page load. Worth offering first here:
  // the likely causes are a dropped database connection or a cold start, and re-running the
  // queue build is both cheaper and less disorienting than navigating away from study.
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Study route error boundary caught an error:", error);
  }, [error]);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 text-center pt-safe pb-safe">
      {/* Sleepy, not startled: BRAND.md §2 assigns this mood to a failed load, and the root
          boundary's "wow" is for the app-wide surprise rather than a queue that would not
          build. */}
      <Parrot expr="sleepy" title="Pī looking concerned" style={{ width: 124, height: 138 }} />

      <h1 className="mt-4 text-2xl" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
        Couldn&apos;t load your cards
      </h1>
      {/* BRAND.md §1: the failure is ours and the copy says so. The reassurance is also
          literally true, and it is the thing a learner actually wants to know: a queue build
          only reads, so nothing they had already rated can have been lost. */}
      <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
        That one is on us. Your progress is safe — building the queue only reads it.
      </p>

      <div className="mt-6 flex gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">
          Try again
        </button>
        {/* `/home`, not `/`, unlike the root boundary: reaching this screen at all required a
            session, so there is no signed-out visitor to route around here, and the hub is
            where the other study modes are. */}
        <Link href="/home" className="btn btn-ghost">
          Home
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
