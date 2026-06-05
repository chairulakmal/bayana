"use client";

// UserMenu — avatar button + dropdown for the home hub (SPEC §8.5, §13 Phase 3).
//
// Shows the signed-in user's email initial (or a ghost icon for demo accounts) inside
// a magenta circle. Tapping it opens a dropdown with:
//   • Stats and Browse (secondary navigation)
//   • Sign out / End demo (destructive — separated by a divider)
//
// `isDemo` switches to demo-account copy and calls `demoSignOutAction` (cookie delete)
// instead of `signOutAction` (DB session delete). Real-user behaviour is unchanged.

import { useState } from "react";
import Link from "next/link";
import { signOutAction, demoSignOutAction } from "@/app/home/actions";

export function UserMenu({ email, isDemo }: { email: string; isDemo: boolean }) {
  const [open, setOpen] = useState(false);
  // Demo accounts have no email; real users fall back to "?" only if somehow empty.
  const initial = isDemo ? "?" : (email.trim()[0]?.toUpperCase() ?? "?");

  return (
    <div className="relative">
      {/* Avatar circle — email initial (or ? for demo), magenta background */}
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
          {/* Tap-to-close backdrop */}
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-[var(--r-lg)]"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              boxShadow: "0 8px 24px rgba(0,0,0,.12)",
            }}
          >
            {/* Account header */}
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--line)" }}>
              {isDemo ? (
                <>
                  <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                    Demo account
                  </p>
                  <p className="mt-0.5 text-[11px]" style={{ color: "var(--ink-faint)" }}>
                    Progress lives in this browser only
                  </p>
                </>
              ) : (
                <p className="truncate text-[12px]" style={{ color: "var(--ink-faint)" }}>
                  {email}
                </p>
              )}
            </div>

            {/* Navigation */}
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

            {/* Sign out / End demo */}
            <form
              action={isDemo ? demoSignOutAction : signOutAction}
              style={{ borderTop: "1px solid var(--line)" }}
            >
              <button
                type="submit"
                role="menuitem"
                className="flex h-12 w-full items-center px-4 text-[15px] active:opacity-70"
                style={{ color: "var(--bad)" }}
              >
                {isDemo ? "End demo" : "Sign out"}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
