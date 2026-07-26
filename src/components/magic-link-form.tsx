"use client";

// The sign-in form: email field, submit button, and the error message for a rejected address.
//
// A client component for one reason: the button needs a pending state. A slow Resend call left
// "Send magic link" looking dead for a second or more, which reads as a broken button and invites
// the double-submit that sends two emails. `useActionState` gives the third value the plain
// `<form action>` could not: whether the action is in flight.
//
// The error alert lives here rather than in the page so there is exactly one renderer for it.
// Two sources can produce an error code (this form's own submit, and an `?error=` redirect from
// Auth.js's own flows such as a bad callback or an expired link), and rendering them in two places
// is how a page ends up showing two contradictory alerts at once.

import { useActionState } from "react";
import { sendMagicLink, type MagicLinkState } from "@/app/auth/signin/actions";

/** Human-readable copy for the error codes we can receive. Kept beside the markup that shows it,
 *  so the action stays free of user-facing prose. */
function errorMessage(code: string | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case "AccessDenied":
      // Bayana is invite-only (single-email allowlist, §11.2). Most people who hit this
      // simply mistyped their address, so lead with that; the owner contact is the path
      // for anyone who believes they should have access.
      return "This email isn't on the access list. Double-check for a typo — or if you think you should have access, reach out to the site owner.";
    default:
      return "Couldn't send the magic link. Please try again.";
  }
}

export function MagicLinkForm({
  initial,
}: {
  /**
   * The error to show before any submit, derived by the page from `?error=`. Passed as
   * `useActionState`'s initial state rather than a separate `initialError` prop, which is what
   * removes the "which of these two errors is current?" question entirely: the first submit's
   * result *replaces* this value, so a stale code from the URL can never sit beside a fresh one.
   */
  initial: MagicLinkState;
}) {
  const [state, formAction, pending] = useActionState(sendMagicLink, initial);
  const message = errorMessage(state.errorCode);

  return (
    <>
      {message && (
        <div
          role="alert"
          className="mt-5 rounded-[var(--r-md)] px-4 py-3 text-left text-sm"
          style={{ background: "#ffe9ee", color: "#b12a44" }}
        >
          <p>{message}</p>
          {state.errorCode === "AccessDenied" && state.contactEmail && (
            <p className="mt-1">
              <a
                href={`mailto:${state.contactEmail}?subject=${encodeURIComponent("Bayana access request")}`}
                className="font-semibold underline"
                style={{ color: "var(--grape)" }}
              >
                Email the site owner
              </a>
            </p>
          )}
        </div>
      )}

      <form action={formAction} className="mt-6 flex flex-col gap-3">
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          // `.focus-ring` and `focus-visible:`, matching both search fields, rather than the
          // `outline-none` + `focus:border-*` pair this had. Two fixes in one line: the ring is
          // carried on box-shadow so the inline `background` below cannot beat it (which is why
          // that utility exists at all), and `focus-visible` keeps it off pointer taps, where a
          // ring on a field the user just tapped is noise.
          className="focus-ring min-h-12 rounded-[var(--r-md)] border-2 border-[var(--line)] px-4 text-base outline-none focus-visible:border-[var(--magenta)]"
          style={{ background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--f-body)" }}
        />
        {/* `disabled` is correct here, unlike on the level picker's rows: a second submit sends a
            second email, and the control the user just pressed is the one thing on this screen
            that must not accept a repeat. `aria-busy` announces the wait, and the label changes
            too, so the state is not carried by the disabled attribute alone. */}
        <button className="btn btn-primary btn-lg w-full" disabled={pending} aria-busy={pending}>
          {pending ? "Sending…" : "Send magic link"}
        </button>
      </form>
    </>
  );
}
