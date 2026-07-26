"use server";

// Server action for the sign-in form. Extracted from the inline `<form action>` in `page.tsx`
// when the form gained a pending state: `useActionState` is a client hook, so the form had to
// become a client component, and a client component cannot declare an inline `"use server"`
// function. Nothing about the auth flow changed in the move.
//
// Every export here is web-reachable by definition (a Server Action is exactly as reachable as a
// route handler, SPEC §11), so treat the arguments as untrusted. The only input is an email
// string, and the allowlist check that guards it lives in the `signIn` callback in `src/auth.ts`,
// deliberately not duplicated here, since one gate is auditable and two drift.

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

/**
 * What the form renders after a submit and, doubling as `useActionState`'s initial value, what an
 * `?error=` redirect from Auth.js's own flows renders on first paint. Only ever an error: the
 * success path never returns, because `signIn` redirects.
 *
 * `errorCode` is Auth.js's `AuthError["type"]` (e.g. "AccessDenied") rather than a message, so the
 * copy stays in the component that renders it and this file stays free of user-facing prose.
 */
export type MagicLinkState = {
  errorCode?: string;
  /**
   * The owner's contact address, included **only** alongside "AccessDenied".
   *
   * It travels in the action's result rather than as a prop on the form for a reason worth
   * keeping: a prop would serialize the address into the payload of every sign-in page load,
   * where a scraper would find it. Returning it with the one error that offers it preserves the
   * original exposure: visible to someone actually denied access, and to nobody else.
   */
  contactEmail?: string;
};

/**
 * Send a magic link to the submitted address.
 *
 * Shaped for `useActionState`, hence the unused first parameter (the previous state). On success
 * Auth.js emails the link and redirects to `/auth/verify-request`, which it does by *throwing*
 * `NEXT_REDIRECT`, so that throw must propagate, and only `AuthError` may be caught here.
 * Swallowing everything would turn a successful sign-in into a form that silently does nothing.
 *
 * A non-allowlisted address makes our `signIn` callback return false, which Auth.js reports as
 * an `AuthError` of type "AccessDenied". That now comes back as state instead of a redirect to
 * `?error=`, which is the point of the change: the page no longer round-trips to tell the user
 * they mistyped their email.
 */
export async function sendMagicLink(
  _prev: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  try {
    await signIn("resend", {
      email: String(formData.get("email") ?? ""),
      redirectTo: "/home",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return {
        errorCode: err.type,
        // Server-only env (NOT NEXT_PUBLIC_), so the address stays out of source and the client
        // bundle; it reaches the browser only in this one response, and only for this one error.
        contactEmail:
          err.type === "AccessDenied" ? process.env.OWNER_CONTACT_EMAIL : undefined,
      };
    }
    // Anything else — including the success-path NEXT_REDIRECT — must propagate.
    throw err;
  }
  // Unreachable in practice: a successful `signIn` redirects. Returning cleared state rather
  // than throwing keeps the function total, so a future Auth.js version that returns instead of
  // redirecting degrades to "no error shown" rather than a crash.
  return {};
}
