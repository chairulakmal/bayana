"use client";

// UserMenu — avatar button + profile dropdown, shared across all hub pages.
//
// Shows the signed-in user's email initial (or ? for demo accounts) in a grape circle.
// Tapping opens a small dropdown with account info and sign-out. Navigation (Stats,
// Browse) lives in BottomNav; this component only handles identity and session end.
//
// `isDemo` switches to demo-account copy and calls `demoSignOutAction` (cookie delete)
// instead of `signOutAction` (DB session delete). Real-user behaviour is unchanged.

import { useState } from "react";
import { signOutAction, demoSignOutAction } from "@/app/home/actions";

export function UserMenu({ email, isDemo }: { email: string; isDemo: boolean }) {
  const [open, setOpen] = useState(false);
  // Demo accounts have no email; real users fall back to "?" only if somehow empty.
  const initial = isDemo ? "?" : (email.trim()[0]?.toUpperCase() ?? "?");

  return (
    <div className="relative">
      {/* Avatar circle — grape (mag-600) gives AA contrast for white text (BRAND §3) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 w-9 items-center justify-center rounded-full text-[15px] font-bold"
        style={{ background: "var(--grape)", color: "#fff", fontFamily: "var(--f-display)" }}
      >
        {initial}
      </button>

      {open && (
        <>
          {/* Tap-to-close backdrop */}
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />

          {/* Dropdown — brand shadow token, r-lg radius */}
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-[var(--r-lg)]"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              boxShadow: "var(--shadow)",
            }}
          >
            {/* Account header */}
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--line)" }}>
              {isDemo ? (
                <>
                  <p
                    className="text-[13px] font-semibold"
                    style={{ color: "var(--ink)", fontFamily: "var(--f-display)" }}
                  >
                    Demo account
                  </p>
                  <p
                    className="mt-0.5 text-[11px]"
                    style={{ color: "var(--ink-faint)", fontFamily: "var(--f-body)" }}
                  >
                    Progress lives in this browser only
                  </p>
                </>
              ) : (
                <p
                  className="truncate text-[12px]"
                  style={{ color: "var(--ink-faint)", fontFamily: "var(--f-body)" }}
                >
                  {email}
                </p>
              )}
            </div>

            {/* Sign out / End demo */}
            <form action={isDemo ? demoSignOutAction : signOutAction}>
              <button
                type="submit"
                role="menuitem"
                className="flex h-12 w-full items-center px-4 text-[15px] active:opacity-70 hover:bg-[var(--surface-cream)]"
                style={{ color: "var(--bad)", fontFamily: "var(--f-display)" }}
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
