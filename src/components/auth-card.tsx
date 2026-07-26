// The shell every `/auth` screen renders: a centred card on the cream page, the wordmark
// above it linking home, and one subtitle line under that.
//
// Extracted when the magic-link flow gained its own verify-request and error pages, because
// the alternative was a third hand-copy of the same twenty lines. The repo already carries
// that debt once (`Centered`, byte-identical in four session components, tracked in TODO.md),
// and one instance of it is enough to learn from.
//
// Parameterised only on what the three screens actually differ on: the mascot's mood, its
// accessible name, the subtitle, the body, and anything that sits outside the card. Anything
// they share belongs in here rather than in a prop.

import Link from "next/link";
import type { ReactNode } from "react";
import { Parrot, type PiExpression } from "@/components/parrot";

export function AuthCard({
  expr = "happy",
  parrotTitle = "Pī, the Bayana mascot",
  subtitle,
  children,
  below,
}: {
  /** Mascot mood. BRAND.md §2 maps moods to moments: wink invites, sleepy carries failure. */
  expr?: PiExpression;
  /** Accessible name for the mascot, which renders as a labelled `role="img"`, not decoration. */
  parrotTitle?: string;
  /** One line under the wordmark, usually a Japanese/English pair. */
  subtitle: ReactNode;
  /** The screen's own content, inside the card. */
  children: ReactNode;
  /** Optional content below the card, outside it (the dev-login shortcut is the only user). */
  below?: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div
        className="w-full max-w-sm rounded-[var(--r-lg)] px-6 py-8 text-center"
        style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow)" }}
      >
        {/* Wordmark doubles as the way back to the landing page, and it matters on all three
            screens for the same reason: without it each one is terminal. A visitor who reaches
            sign-in without an invite, or whose link has expired, would have only the browser
            back button to reach the demo CTA. Logo-goes-home is the convention, so it needs no
            extra link competing with the page's real CTA. Internal link, so same tab.

            The wordmark is the `<h1>` and each screen's own headline is an `<h2>`: the site is
            what the page is *of*, the headline is what state it is *in*, and heading navigation
            finds both. */}
        <Link href="/" className="inline-block" aria-label="Bayana home">
          <Parrot expr={expr} title={parrotTitle} style={{ width: 72, height: 80, margin: "0 auto" }} />

          <h1 className="mt-3 text-3xl" style={{ fontFamily: "var(--f-display)", fontWeight: 600, color: "var(--ink)" }}>
            b<b style={{ color: "var(--mag-700)" }}>a</b>yana
          </h1>
        </Link>
        <p className="mt-1 text-[15px]" style={{ color: "var(--ink-soft)" }}>
          {subtitle}
        </p>

        {children}
      </div>

      {below}
    </main>
  );
}
