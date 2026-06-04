"use client";

// UserMenu — avatar button + dropdown for the home hub (SPEC §8.5, §13 Phase 3).
//
// Shows the signed-in user's email initial inside a magenta circle. Tapping it
// opens a dropdown with:
//   • Stats and Browse (secondary navigation)
//   • Sign out (destructive — separated by a divider)
//
// Kept on the home hub only; study/quiz screens are deliberately uncluttered.
//
// Mobile-friendly choices:
//   • A full-screen transparent backdrop (fixed inset-0) dismisses the menu on
//     tap-outside. This is more reliable than click-outside detection on iOS,
//     where click events don't bubble the same way through non-interactive elements.
//   • Menu items are 48px tall — above Apple's 44pt minimum tap target guideline.
//   • Sign out uses a <form action={}> server action so the DB session is cleared
//     server-side before the redirect, not via a client-side fetch.

import { useState } from "react";
import Link from "next/link";
import { signOutAction } from "@/app/home/actions";

export function UserMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  // Fall back to "?" if email somehow arrives empty.
  const initial = email.trim()[0]?.toUpperCase() ?? "?";

  return (
    <div className="relative">
      {/* Avatar circle — email initial, magenta background */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 w-9 items-center justify-center rounded-full text-[15px] font-bold"
        style={{ background: "var(--mag-500)", color: "#fff" }}
      >
        {initial}
      </button>

      {open && (
        <>
          {/* Tap-to-close backdrop — covers the whole screen behind the dropdown.
              Transparent, so visually nothing changes; tap anywhere outside closes the menu. */}
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-[var(--r-lg)]"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              // Slightly heavier shadow than the card default — makes the menu float.
              boxShadow: "0 8px 24px rgba(0,0,0,.12)",
            }}
          >
            {/* Signed-in email — non-interactive header, lets the user confirm who's signed in */}
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--line)" }}>
              <p className="truncate text-[12px]" style={{ color: "var(--ink-faint)" }}>
                {email}
              </p>
            </div>

            {/* Navigation items — Stats first (most informational), then Browse */}
            <Link
              href="/stats"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex h-12 items-center px-4 text-[15px] active:opacity-70"
              style={{ color: "var(--ink)" }}
            >
              Stats
            </Link>
            <Link
              href="/browse"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex h-12 items-center px-4 text-[15px] active:opacity-70"
              style={{ color: "var(--ink)" }}
            >
              Browse
            </Link>

            {/* Sign out — divider separates destructive action from navigation */}
            <form action={signOutAction} style={{ borderTop: "1px solid var(--line)" }}>
              <button
                type="submit"
                role="menuitem"
                className="flex h-12 w-full items-center px-4 text-[15px] active:opacity-70"
                style={{ color: "var(--bad)" }}
              >
                Sign out
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
