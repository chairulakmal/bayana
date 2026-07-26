import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { MagicLinkForm } from "@/components/magic-link-form";

// Sign-in screen (BRAND.md): enter the allowlisted email → receive a one-time magic link.
// The form calls the `sendMagicLink` server action, which calls Auth.js `signIn`; on success
// Auth.js sends the email and redirects to our own "check your email" page
// (`/auth/verify-request`).
//
// This page is now only the shell: the form, its pending state and its error message all live in
// `MagicLinkForm`, because the submit button needed to know whether the action was in flight and
// that is a client concern. The error *copy* moved with it; see that file for why one renderer
// rather than two.
//
// What stays here is the one thing that cannot cross to the client: reading `?error=`, which
// Auth.js's own flows (a bad callback, an expired link) still redirect back with, and the
// server-only owner-contact env var.

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  // Next.js 16: searchParams is async and must be awaited.
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Optional owner contact for the access-denied case. Server-only env (NOT committed,
  // NOT NEXT_PUBLIC_) so the address stays out of source and the client bundle; it only
  // appears in the rendered HTML when set, which is the whole point here. Falls back to
  // plain text when unset.
  const contactEmail = process.env.OWNER_CONTACT_EMAIL;

  return (
    <AuthCard
      subtitle={
        <>
          <span lang="ja" className="jp">メールのリンクでログイン</span> · sign in with your email
        </>
      }
      /* Below the card: the policy links, plus the dev-only shortcut when it is enabled.
         The policy links belong on *this* screen specifically, and not merely for
         completeness — this is the one place a visitor decides whether to hand over an email
         address, so it is the last moment where "what happens to it?" is still a question
         they can act on. Internal links, so they stay in the same tab and the half-typed
         address in the field survives the trip.

         The dev shortcut skips the magic link locally (SPEC §11.7) and is rendered only when
         the bypass is actually enabled, so it never appears in production. */
      below={
        <>
          <p className="mt-5 text-[12px]" style={{ color: "var(--ink-faint)" }}>
            <Link href="/privacy" className="font-semibold underline">
              Privacy
            </Link>{" "}
            ·{" "}
            <Link href="/terms" className="font-semibold underline">
              Terms of use
            </Link>
          </p>
          {process.env.NODE_ENV !== "production" && process.env.DEV_AUTH === "1" && (
            <a
              href="/api/dev/login"
              className="mt-3 inline-block text-[13px] font-semibold underline"
              style={{ color: "var(--ink-faint)" }}
            >
              Dev login (skip email)
            </a>
          )}
        </>
      }
    >
      {/* The owner contact rides along only with "AccessDenied", which is the one error that
          offers it; see `MagicLinkState.contactEmail` for why it is not an unconditional prop. */}
      <MagicLinkForm
        initial={
          error
            ? {
                errorCode: error,
                contactEmail: error === "AccessDenied" ? contactEmail : undefined,
              }
            : {}
        }
      />

      <p className="mt-5 text-[12px]" style={{ color: "var(--ink-faint)" }}>
        Invite-only · a one-time link, no password to remember.
      </p>

      {/* Demo divider — always visible. Starts a fresh ephemeral session each click.
          Progress is cookie-bound (7 days); user is warned on the home hub.
          A form POST (not a link) because the route is POST-only: a state-changing
          GET could be triggered cross-site or by prefetching (SPEC §11.8). */}
      <div className="mt-5 flex items-center gap-3">
        <div className="flex-1" style={{ height: 1, background: "var(--line)" }} />
        <span className="text-[11px]" style={{ color: "var(--ink-faint)" }}>or</span>
        <div className="flex-1" style={{ height: 1, background: "var(--line)" }} />
      </div>
      <form method="post" action="/api/demo/login">
        <button type="submit" className="btn btn-ghost mt-3 w-full">
          Try demo →
        </button>
      </form>
      <p className="mt-2 text-[11px]" style={{ color: "var(--ink-faint)" }}>
        No sign-up needed · progress lives in this browser for 7 days
      </p>
    </AuthCard>
  );
}
