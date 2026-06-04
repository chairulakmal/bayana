import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

// Minimal sign-in screen: enter the allowlisted email → receive a one-time magic link.
// The form posts to a server action that calls Auth.js `signIn`; on success Auth.js sends
// the email and redirects to its "check your email" page.
//
// Error handling: a non-allowlisted email makes our `signIn` callback (src/auth.ts) return
// false, so Auth.js throws an `AuthError` (type "AccessDenied"). Left unhandled, that
// surfaces as an ugly 500. We catch `AuthError`, bounce back to this page with an `?error`
// code, and render a friendly message — while RE-THROWING everything else, because on
// success `signIn` itself throws a `NEXT_REDIRECT` that must propagate to do the redirect.

/** Human-readable copy for the error codes we redirect back with. */
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

export default async function SignInPage({
  searchParams,
}: {
  // Next.js 16: searchParams is async and must be awaited.
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = errorMessage(error);

  // Optional owner contact for the access-denied case. Server-only env (NOT committed,
  // NOT NEXT_PUBLIC_) so the address stays out of source and the client bundle; it only
  // appears in the rendered HTML when set, which is the whole point here. Falls back to
  // plain text when unset.
  const contactEmail = process.env.OWNER_CONTACT_EMAIL;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-white px-6 text-slate-900">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-3xl font-bold">🦜 Bayana</h1>
        <p className="mt-2 text-slate-500">Sign in with your email to study.</p>

        {message && (
          <div
            role="alert"
            className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            <p>{message}</p>
            {error === "AccessDenied" && contactEmail && (
              <p className="mt-1">
                <a
                  href={`mailto:${contactEmail}?subject=${encodeURIComponent("Bayana access request")}`}
                  className="font-medium underline"
                >
                  Email the site owner
                </a>
              </p>
            )}
          </div>
        )}

        <form
          action={async (formData: FormData) => {
            "use server";
            try {
              await signIn("resend", {
                email: String(formData.get("email") ?? ""),
                redirectTo: "/home",
              });
            } catch (err) {
              // Denied/again? Show it on the page instead of a 500.
              if (err instanceof AuthError) {
                redirect(`/auth/signin?error=${err.type}`);
              }
              // Anything else — including the success-path NEXT_REDIRECT — must propagate.
              throw err;
            }
          }}
          className="mt-6 flex flex-col gap-3 text-left"
        >
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="min-h-12 rounded-lg border border-slate-300 px-3 text-base"
          />
          <button className="min-h-12 rounded-lg bg-slate-900 text-base font-semibold text-white active:bg-slate-700">
            Send magic link
          </button>
        </form>

        {/* Dev-only shortcut: skip the magic link locally (SPEC §11.7). Rendered only when
            the bypass is actually enabled, so it never appears in production. */}
        {process.env.NODE_ENV !== "production" && process.env.DEV_AUTH === "1" && (
          <a
            href="/api/dev/login"
            className="mt-4 inline-block text-[13px] font-semibold text-slate-400 underline"
          >
            Dev login (skip email)
          </a>
        )}
      </div>
    </main>
  );
}
