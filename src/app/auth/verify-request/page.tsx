// "Check your email" screen, reached the moment a magic link has been sent.
//
// Auth.js ships its own page at `/api/auth/verify-request` and uses it unless
// `pages.verifyRequest` names this route (src/auth.ts). The built-in is an unstyled white
// page in a system font with generic copy and no Pī, which is the worst possible place to
// drop the brand: the visitor has just committed to signing in, has nothing to do but wait,
// and this screen is all they have to look at while they do it.
//
// Deliberately static. Auth.js redirects here without the address it just mailed, and the
// obvious way to echo it back would be putting an email address in a query string, which is
// worse than generic copy. Nothing on this page needs the session or the request.

import Link from "next/link";
import { AuthCard } from "@/components/auth-card";

export const metadata = { title: "Check your email" };

export default function VerifyRequestPage() {
  return (
    <AuthCard
      // Wink is BRAND.md §2's "closing invitation" mood, which is exactly this screen's job:
      // the work is done, go and look in your inbox.
      expr="wink"
      parrotTitle="Pī winking"
      subtitle={
        <>
          <span lang="ja" className="jp">
            メールを確認してください
          </span>{" "}
          · check your inbox
        </>
      }
    >
      <h2 className="mt-6 text-2xl" style={{ fontFamily: "var(--f-display)", fontWeight: 600, color: "var(--ink)" }}>
        Link sent 📬
      </h2>
      {/* The two properties worth stating, because both change what the user should do next:
          a link that has expired needs a new one, and a link that has already been used
          explains why the second tap did nothing. Both numbers track `TOKEN_TTL_SECONDS` in
          src/auth.ts, which is where the 15 minutes is actually configured. */}
      <p className="mt-2 text-[15px]" style={{ color: "var(--ink-soft)" }}>
        A one-time sign-in link is on its way. It expires in 15 minutes and works once.
      </p>
      <p className="mt-4 text-[13px]" style={{ color: "var(--ink-faint)" }}>
        Nothing there after a minute? Check your spam folder, or ask for a fresh link.
      </p>

      <Link href="/auth/signin" className="btn btn-ghost mt-5 w-full">
        Back to sign in
      </Link>
    </AuthCard>
  );
}
