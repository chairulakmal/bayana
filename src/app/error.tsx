"use client";

// Route error boundary — the app's catch-all for a render or data-fetch failure in any
// segment below the root layout. Before this file existed, a thrown server error rendered
// Next.js's own unstyled default page: black Helvetica on white, against an app whose every
// other surface is cream. That is not just ugly, it reads as "you have left the site".
//
// This must be a Client Component. React error boundaries are a client-side mechanism
// (`componentDidCatch`), so Next.js requires the "use client" directive here even though
// most of what it catches originates on the server.
//
// What it does NOT catch: errors thrown by the root layout itself, which sits above this
// boundary. Those are `global-error.tsx`'s job. See that file for why it has to be built so
// differently.

import { useEffect } from "react";
import Link from "next/link";
import { Parrot } from "@/components/parrot";

export default function RouteError({
  error,
  reset,
}: {
  // `digest` is present when the error came from the server. Next.js deliberately replaces
  // the real message with a generic one before sending it to the browser, and gives us this
  // hash instead — the same hash it logs server-side, so it is the join key between what a
  // user reports and what Railway's logs show.
  error: Error & { digest?: string };
  // Re-renders the segment without a full page reload. Worth offering because a good share
  // of these are transient (a dropped database connection, a cold start), and re-running the
  // failed render is cheaper and less disorienting than making the user navigate away.
  reset: () => void;
}) {
  useEffect(() => {
    // Safe to log: for a server error this object carries Next's redacted message plus the
    // digest, never the original stack or any query payload, so this cannot leak data the
    // client did not already hold.
    console.error("Route error boundary caught an error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <Parrot expr="wow" title="Pī, startled" style={{ width: 112, height: 125 }} />

      <div>
        <h1 className="text-2xl" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
          Something went wrong
        </h1>
        {/* Brand voice (BRAND.md §1): encouraging, never a scold. The failure is ours, so the
            copy owns it rather than implying the user did something. */}
        <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          That one is on us, not you. Your progress is saved — nothing was lost.
        </p>
      </div>

      <div className="flex w-full flex-col gap-3">
        <button type="button" onClick={reset} className="btn btn-primary w-full">
          Try again
        </button>
        {/* Destination is "/", not "/home", on purpose. This boundary wraps the public
            marketing page as well as the signed-in app, and "/" already routes each visitor
            correctly: it redirects a signed-in user straight to /home, and shows the landing
            page to everyone else. Hardcoding /home would bounce a signed-out visitor into
            the sign-in screen from an error page, which reads as a second failure. */}
        <Link href="/" className="btn btn-ghost w-full">
          Back to start
        </Link>
      </div>

      {/* Shown only when the server supplied one. It looks like noise, but it is the single
          thing that makes a bug report actionable: paste this hash, find the exact stack in
          the deployment logs. */}
      {error.digest && (
        <p className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
          Reference: <code>{error.digest}</code>
        </p>
      )}
    </main>
  );
}
