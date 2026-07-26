"use client";

// Last-resort error boundary — for failures in the root layout itself, which sits ABOVE
// `error.tsx` and therefore cannot be caught by it. Think: a broken import in `layout.tsx`,
// a throw in the font setup, a bad `metadata` export.
//
// This file is written very differently from every other component in the app, and the
// reason is worth understanding rather than pattern-matching:
//
//   1. It REPLACES the root layout. React unmounts the failed tree entirely, so this
//      component must render its own <html> and <body> — the only file in the app that does
//      besides layout.tsx.
//   2. It cannot use the brand type. The faces reach components through the --font-* custom
//      properties that `fontVariables` sets on <html> in the root layout. That layout is by
//      definition the thing that just failed, so those properties do not exist here. Same
//      for every design token in globals.css: whether that stylesheet is still attached
//      depends on which chunk failed, so relying on it would make the fallback's appearance
//      conditional on the nature of the crash.
//
// Hence: literal hex values from BRAND.md §8 and a system font stack, inline. Slightly
// off-brand type on a page almost nobody sees beats a fallback that renders unstyled
// precisely when things are already at their worst.
//
// Note it only appears in production. In development, Next.js shows its own error overlay
// instead, so `npm run dev` is not the way to eyeball this page.

import { Parrot } from "@/components/parrot";

// BRAND.md §8, inlined because the token layer is unavailable here (see header).
const PAPER = "#fcfaf1";
const INK = "#341832";
const INK_SOFT = "#684e65";
const GRAPE = "#b717b2";
const GRAPE_EDGE = "#7c0079";

const SYSTEM_STACK =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    // `lang` is set here too: the root layout that normally carries it is gone.
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          padding: "24px",
          textAlign: "center",
          background: PAPER,
          color: INK,
          fontFamily: SYSTEM_STACK,
        }}
      >
        {/* Safe to render even here: the mascot is inline SVG with its own literal palette,
            so it depends on neither the stylesheet nor the font layer. */}
        <Parrot expr="wow" title="Pī, startled" style={{ width: 112, height: 125 }} />

        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Bayana hit a snag</h1>
        <p style={{ margin: 0, maxWidth: 380, fontSize: 15, lineHeight: 1.6, color: INK_SOFT }}>
          The app failed to start up. Reloading usually clears it — your study progress is
          stored on the server and is unaffected.
        </p>

        {/* A plain <a>, not next/link, and a full document load rather than a client-side
            navigation. The router lives in the tree that just failed, so a soft navigation
            could land straight back in the same broken state; a real reload rebuilds
            everything from scratch, which is the actual remedy being offered.

            The lint rule below is a good default and wrong here for that exact reason: it
            assumes a working router is available to navigate with, which is the one thing
            this file cannot assume. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 48,
            padding: "15px 30px",
            borderRadius: 18,
            background: GRAPE,
            color: "#fff",
            fontSize: 17,
            fontWeight: 600,
            textDecoration: "none",
            boxShadow: `0 5px 0 ${GRAPE_EDGE}`,
          }}
        >
          Reload Bayana
        </a>

        {error.digest && (
          <p style={{ margin: 0, fontSize: 11, color: INK_SOFT }}>
            Reference: <code>{error.digest}</code>
          </p>
        )}
      </body>
    </html>
  );
}
