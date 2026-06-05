import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { Parrot } from "@/components/parrot";

// Sign-in screen (BRAND.md): enter the allowlisted email → receive a one-time magic link.
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
    <main className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div
        className="w-full max-w-sm rounded-[var(--r-lg)] px-6 py-8 text-center"
        style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow)" }}
      >
        <Parrot expr="happy" title="Pī, the Bayana mascot" style={{ width: 72, height: 80, margin: "0 auto" }} />

        <h1 className="mt-3 text-3xl" style={{ fontFamily: "var(--f-display)", fontWeight: 600, color: "var(--ink)" }}>
          b<b style={{ color: "var(--mag-700)" }}>a</b>yana
        </h1>
        <p className="mt-1 text-[15px]" style={{ color: "var(--ink-soft)" }}>
          <span className="jp">メールのリンクでログイン</span> · sign in with your email
        </p>

        {message && (
          <div
            role="alert"
            className="mt-5 rounded-[var(--r-md)] px-4 py-3 text-left text-sm"
            style={{ background: "#ffe9ee", color: "#b12a44" }}
          >
            <p>{message}</p>
            {error === "AccessDenied" && contactEmail && (
              <p className="mt-1">
                <a
                  href={`mailto:${contactEmail}?subject=${encodeURIComponent("Bayana access request")}`}
                  className="font-semibold underline"
                  style={{ color: "var(--grape)" }}
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
          className="mt-6 flex flex-col gap-3"
        >
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="min-h-12 rounded-[var(--r-md)] border-2 border-[var(--line)] px-4 text-base outline-none focus:border-[var(--magenta)]"
            style={{ background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--f-body)" }}
          />
          <button className="btn btn-primary btn-lg w-full">Send magic link</button>
        </form>

        <p className="mt-5 text-[12px]" style={{ color: "var(--ink-faint)" }}>
          Invite-only · a one-time link, no password to remember.
        </p>

        {/* Demo divider — always visible. Starts a fresh ephemeral session each click.
            Progress is cookie-bound (7 days); user is warned on the home hub. */}
        <div className="mt-5 flex items-center gap-3">
          <div className="flex-1" style={{ height: 1, background: "var(--line)" }} />
          <span className="text-[11px]" style={{ color: "var(--ink-faint)" }}>or</span>
          <div className="flex-1" style={{ height: 1, background: "var(--line)" }} />
        </div>
        <a
          href="/api/demo/login"
          className="btn btn-ghost mt-3 w-full"
        >
          Try demo →
        </a>
        <p className="mt-2 text-[11px]" style={{ color: "var(--ink-faint)" }}>
          No sign-up needed · progress lives in this browser for 7 days
        </p>
      </div>

      {/* Dev-only shortcut: skip the magic link locally (SPEC §11.7). Rendered only when the
          bypass is actually enabled, so it never appears in production. */}
      {process.env.NODE_ENV !== "production" && process.env.DEV_AUTH === "1" && (
        <a
          href="/api/dev/login"
          className="mt-5 inline-block text-[13px] font-semibold underline"
          style={{ color: "var(--ink-faint)" }}
        >
          Dev login (skip email)
        </a>
      )}
    </main>
  );
}
