import Link from "next/link";
import { Parrot } from "@/components/parrot";

// The 404 page, for any URL that matches no route (and for any future `notFound()` call —
// nothing in the app raises one yet, but unmatched URLs already land here).
//
// Who actually sees this is worth knowing, because it decides the copy: `proxy.ts` gates
// every non-public path on a session cookie, so a signed-out visitor mistyping a URL is
// redirected to sign-in and never reaches this page. In practice its audience is a
// signed-in user following a stale link or a typo, which is why the tone is a shrug rather
// than an explanation of what a 404 is.
//
// A plain Server Component with no data access, so Next.js can render it at build time and
// serve it as static HTML — a 404 should never cost a database round-trip.

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      {/* Wink, not a sad face: BRAND.md §1 asks for encouraging over scolding, and a wrong
          URL is a non-event. It is also the expression `HomeLink` uses, so the bird looks
          the same here as on the control that takes you back. */}
      <Parrot expr="wink" title="Pī, winking" style={{ width: 112, height: 125 }} />

      <div>
        <p
          className="text-[13px]"
          style={{ fontFamily: "var(--f-display)", fontWeight: 600, color: "var(--ink-faint)", letterSpacing: ".12em" }}
        >
          404
        </p>
        <h1 className="mt-1 text-2xl" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
          Nothing here
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          This page does not exist — or it moved. Either way,{" "}
          <span lang="ja" className="jp">
            ただいま
          </span>{" "}
          is one tap away.
        </p>
      </div>

      {/* "/" rather than "/home", for the same reason as error.tsx: the landing page already
          redirects a signed-in user to /home, so this one destination is correct for both
          audiences without this page needing to read the session. */}
      <Link href="/" className="btn btn-primary w-full">
        Back to start
      </Link>
    </main>
  );
}
