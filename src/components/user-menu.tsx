"use client";

// UserMenu — avatar button + profile dropdown, shared across all hub pages.
//
// Shows the signed-in user's email initial (or ? for demo accounts) in a grape circle.
// Tapping opens a small dropdown with account info and sign-out. Navigation (Stats,
// Browse) lives in BottomNav; this component only handles identity and session end.
//
// `isDemo` switches to demo-account copy and calls `demoSignOutAction` (cookie delete)
// instead of `signOutAction` (DB session delete). Real-user behaviour is unchanged.
//
// Accessibility: this is a **disclosure**, not an ARIA menu (SPEC §14.15). The trigger owns
// `aria-expanded` + `aria-controls`; the panel is plain content. Three ways out, so a
// keyboard user is never trapped: Escape (returns focus to the avatar), tabbing past the
// last control, or a pointer tap on the backdrop.

import { useEffect, useId, useRef, useState } from "react";
import { signOutAction, demoSignOutAction } from "@/app/home/actions";

export function UserMenu({ email, isDemo }: { email: string; isDemo: boolean }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Stable, SSR-safe id linking the trigger to the panel it reveals.
  const panelId = useId();
  // Demo accounts have no email; real users fall back to "?" only if somehow empty.
  const initial = isDemo ? "?" : (email.trim()[0]?.toUpperCase() ?? "?");

  // Escape closes the panel and puts focus back where it started. Bound to the document
  // rather than to the panel, so it works whether focus is still on the avatar (the usual
  // case, since a disclosure does not move focus on open) or already inside the panel.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div
      className="relative"
      // Close when focus leaves the widget entirely, which is what tabbing past the last
      // control means. Without this the panel stays open behind a keyboard user who has
      // moved on, and the backdrop keeps swallowing their pointer clicks. `relatedTarget`
      // is the element about to receive focus, and is null when focus leaves the document.
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      {/* Avatar circle — grape (mag-600) gives AA contrast for white text (BRAND §3) */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        // `aria-controls` only while the panel exists: pointing at an absent id is a dangling
        // reference, and the relationship it describes genuinely does not exist when closed.
        aria-controls={open ? panelId : undefined}
        // tap-44-box, not tap-44: the vertical-only default would leave this 36px wide. The
        // avatar is the sole control in the page header, so there is no neighbour whose hit
        // area a both-axis overlay could steal, and the painted circle stays 36px (BRAND.md
        // §7 allows a smaller painted box, never a smaller target).
        className="tap-44-box flex h-9 w-9 items-center justify-center rounded-full text-[15px] font-bold"
        style={{ background: "var(--grape)", color: "#fff", fontFamily: "var(--f-display)" }}
      >
        {initial}
      </button>

      {open && (
        <>
          {/* Tap-to-close backdrop */}
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />

          {/* Dropdown — brand shadow token, r-lg radius.
              No `role="menu"`. This panel holds one action plus a line of account text, and
              the menu role advertises a keyboard contract (Up/Down between items, roving
              tabindex, Home/End) that a single item cannot honour. It also made the account
              header an invalid child: a bare <p> is not a `menuitem`/`group`/`separator`, so
              screen readers were entitled to drop the user's own email from the panel. As a
              plain disclosure the header is ordinary content again, and Tab reaches the one
              button on its own because the panel follows the trigger in DOM order. */}
          <div
            id={panelId}
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
