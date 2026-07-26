// Sign-in failure screen, for the failures that happen *after* the form: a magic link that
// has expired or been used, and server-side misconfiguration.
//
// Auth.js routes here because `pages.error` names this route (src/auth.ts); without it, the
// same failures render its unstyled built-in at `/api/auth/error`. This is a different path
// from the sign-in page's own `?error=` handling, which covers what goes wrong while the form
// is being submitted (a non-allowlisted address). That distinction is why both exist:
// `/auth/signin` owns "we would not send you a link", this route owns "the link you were sent
// no longer works".
//
// Copy rule, from BRAND.md §1: a failure is never framed as the learner's fault. Every branch
// below says what happened and what to do next, and none of them apologises or blames.

import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";

export const metadata = { title: "Sign-in problem" };

/** What each Auth.js error code means for the user, and the label of the way out. */
function explain(code: string | undefined): { heading: string; body: string; cta: string } {
  switch (code) {
    case "Verification":
      // The common one by far, and the only one with a genuinely useful next step. Magic links
      // are single-use with a 15-minute TTL (src/auth.ts), so this covers both "too slow" and
      // "already clicked it", which are indistinguishable from the token's point of view.
      return {
        heading: "That link has expired",
        body: "Sign-in links last 15 minutes and can only be used once. Ask for a fresh one and it will work.",
        cta: "Send a new link",
      };
    case "Configuration":
      // Ours, not theirs: a missing env var or a broken provider. Say so plainly rather than
      // implying the user did something, and keep the detail in the server log where it belongs.
      return {
        heading: "Something is wrong on our end",
        body: "Sign-in is misconfigured, so no link could be sent. This one is on us, not on you. Trying again in a few minutes is worth a shot.",
        cta: "Back to sign in",
      };
    default:
      return {
        heading: "Sign-in didn't go through",
        body: "The link couldn't be verified. Asking for a new one is the quickest way through.",
        cta: "Send a new link",
      };
  }
}

export default async function AuthErrorPage({
  searchParams,
}: {
  // Next.js 16: searchParams is async and must be awaited.
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // AccessDenied is deliberately not handled here. `/auth/signin` already renders that
  // message, and it is the only screen that can offer the owner-contact mailto alongside it
  // (gated on OWNER_CONTACT_EMAIL). Two screens explaining the allowlist in slightly different
  // words is how the two copies drift apart, so this one forwards instead of competing.
  if (error === "AccessDenied") redirect("/auth/signin?error=AccessDenied");

  const { heading, body, cta } = explain(error);

  return (
    <AuthCard
      // Sleepy, per BRAND.md §2, which assigns it to failure on purpose: there is no sad or
      // alarmed Pī, because a mascot that looks upset when something breaks makes a technical
      // failure feel like the learner's fault. The copy carries the distinction instead.
      expr="sleepy"
      parrotTitle="Pī looking sleepy"
      subtitle={
        <>
          <span lang="ja" className="jp">
            ログインできませんでした
          </span>{" "}
          · sign-in didn&apos;t work
        </>
      }
    >
      <h2 className="mt-6 text-2xl" style={{ fontFamily: "var(--f-display)", fontWeight: 600, color: "var(--ink)" }}>
        {heading}
      </h2>
      <p className="mt-2 text-[15px]" style={{ color: "var(--ink-soft)" }}>
        {body}
      </p>

      <Link href="/auth/signin" className="btn btn-primary btn-lg mt-6 w-full">
        {cta}
      </Link>
    </AuthCard>
  );
}
