// Shared shell for the two policy pages, `/privacy` and `/terms`.
//
// It exists so the chrome — back link, heading, last-updated line, contact footer, and the
// prose type scale — is written once rather than twice and then drifting. Both pages are
// public and static: no auth call, no per-user data, nothing dynamic, so Next prerenders
// them at build time.
//
// **Keep framework specifics out of the pages that use this.** The policy text describes
// what the *service* does, which is true of Bayana whatever renders it; route file paths and
// the `proxy.ts` allowlist are implementation detail that would have to be rewritten at the
// Nuxt migration for no reader's benefit.

import Link from "next/link";
import type { ReactNode } from "react";
import { Parrot } from "@/components/parrot";

export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  /** Human-readable date, e.g. "27 July 2026". Shown under the heading. */
  updated: string;
  /** One or two sentences setting out what this document is, before the sections start. */
  intro: ReactNode;
  children: ReactNode;
}) {
  // Server-only env var (not NEXT_PUBLIC_), the same pattern the hub and sign-in page use:
  // the address appears in rendered HTML but never in the client bundle or source control.
  //
  // Read at BUILD time here, unlike on the hub. These two pages are prerendered, so whatever
  // the variable holds when `next build` runs is what ships until the next deploy; if it is
  // unset at build time the fallback below renders instead. That is the price of keeping
  // them static, and it is the right trade for a page whose content changes a few times a
  // year. If the address ever needs to be swappable without a deploy, the fix is to make it
  // a link to the repository rather than to make these pages dynamic.
  const contactEmail = process.env.OWNER_CONTACT_EMAIL;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col px-5 py-8">
      {/* Back to "/", not "/home": these pages are public, and a signed-out reader sent to
          /home would be bounced to sign-in, which reads as being thrown out of a document
          they were invited to read. "/" already routes each visitor correctly. */}
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1 active:opacity-70"
        style={{
          fontFamily: "var(--f-display)",
          fontWeight: 600,
          fontSize: 13,
          padding: "4px 10px",
          borderRadius: 999,
          background: "var(--surface)",
          boxShadow: "inset 0 0 0 1.5px var(--pink-200), 0 2px 0 var(--line)",
          color: "var(--grape)",
        }}
      >
        <span aria-hidden style={{ color: "var(--ink-faint)" }}>
          ←
        </span>
        <span>Bayana</span>
      </Link>

      <div className="mt-7 flex items-center gap-3">
        <Parrot expr="happy" style={{ width: 40, height: 45 }} />
        <div>
          <h1 className="text-2xl" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
            {title}
          </h1>
          <p className="text-[12px]" style={{ color: "var(--ink-faint)" }}>
            Last updated {updated}
          </p>
        </div>
      </div>

      <p className="mt-5 text-[15px] leading-relaxed" style={{ color: "var(--ink)" }}>
        {intro}
      </p>

      {children}

      <hr className="mt-10" style={{ border: 0, borderTop: "1px solid var(--line)" }} />

      <p className="mt-5 pb-10 text-[13px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
        Questions about any of this?{" "}
        {contactEmail ? (
          <a
            href={`mailto:${contactEmail}?subject=${encodeURIComponent(title)}`}
            className="font-semibold underline"
            style={{ color: "var(--grape)" }}
          >
            Email me
          </a>
        ) : (
          "Open an issue on the repository"
        )}
        . The other page is{" "}
        <Link
          href={title === "Privacy" ? "/terms" : "/privacy"}
          className="font-semibold underline"
          style={{ color: "var(--grape)" }}
        >
          {title === "Privacy" ? "Terms of use" : "Privacy"}
        </Link>
        .
      </p>
    </main>
  );
}

/** One titled section of a policy. `<h2>` under the page's single `<h1>`. */
export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-[17px]" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
        {heading}
      </h2>
      <div
        className="mt-2 flex flex-col gap-3 text-[14px] leading-relaxed"
        style={{ color: "var(--ink-soft)" }}
      >
        {children}
      </div>
    </section>
  );
}
