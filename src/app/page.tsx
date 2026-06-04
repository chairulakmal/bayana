import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Parrot } from "@/components/parrot";

// Public marketing homepage (BRAND.md). The primary CTA is "Sign in" — so this page is for
// logged-out visitors. Already signed in? Go straight to the study queue (one-tap start,
// SPEC §2). The authenticated app lives at /study; `/` is public (see proxy.ts).
export default async function Home() {
  const session = await auth();
  if (session) redirect("/home");

  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-dvh flex-col">
      {/* ── Top bar ──────────────────────────────────────────────── */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4">
        <span
          className="flex items-center gap-2 text-2xl"
          style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}
        >
          <Parrot expr="happy" style={{ width: 32, height: 36 }} />
          <span>
            b<b style={{ color: "var(--mag-700)" }}>a</b>yana
          </span>
        </span>
        <Link
          href="/auth/signin"
          className="text-[15px] font-semibold text-[color:var(--grape)] hover:underline"
        >
          Sign in
        </Link>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-5xl items-center gap-10 px-5 pt-8 pb-16 md:grid-cols-2 md:pt-16">
          <div className="text-center md:text-left">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-semibold"
              style={{ background: "var(--cream)", color: "var(--ink)", fontFamily: "var(--f-display)", letterSpacing: ".05em" }}
            >
              JLPT N5 → N1 · 毎日ちょっとずつ
            </span>

            <h1
              className="mt-4 text-[40px] leading-[1.05] sm:text-[52px]"
              style={{ fontFamily: "var(--f-display)", fontWeight: 700, letterSpacing: "-.01em" }}
            >
              Japanese vocab
              <br />
              that sticks.
            </h1>

            <p className="mx-auto mt-4 max-w-md text-[17px] md:mx-0" style={{ color: "var(--ink-soft)" }}>
              Ten words at a time, two minutes a day. Real spaced repetition with an
              AI example sentence for every word — no decks to build, no ads to dodge,
              open it anytime.
            </p>

            {/* Primary CTA — the one thing this page is for. Both buttons share btn-lg so
                they're the same height; the row centers them (left on desktop by default). */}
            <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row">
              <Link href="/auth/signin" className="btn btn-primary btn-lg">
                Sign in →
              </Link>
              <a
                href="https://github.com/chairulakmal/bayana"
                className="btn btn-ghost btn-lg"
                target="_blank"
                rel="noopener noreferrer"
              >
                Source code
              </a>
            </div>

            <p className="mt-4 text-[13px]" style={{ color: "var(--ink-faint)" }}>
              A personal, invite-only project — built in the open.
            </p>
          </div>

          {/* Hero art: Pī on a soft glow, with a JLPT-level flourish. */}
          <div className="relative flex justify-center">
            <div
              className="absolute inset-0 -z-10 m-auto h-64 w-64 rounded-full opacity-60 blur-2xl"
              style={{ background: "var(--pink-200)" }}
              aria-hidden
            />
            <Parrot expr="happy" title="Pī, the Bayana mascot" style={{ width: 230, height: 257 }} />
            <div className="absolute -bottom-2 flex gap-1.5">
              <span className="chip chip-n5">N5</span>
              <span className="chip chip-n4">N4</span>
              <span className="chip chip-n3">N3</span>
              <span className="chip chip-n2">N2</span>
              <span className="chip chip-n1">N1</span>
            </div>
          </div>
        </section>

        {/* ── Features ───────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-5xl px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Feature
              emoji="🎴"
              title="Flashcard mode"
              body="Real spaced repetition — FSRS, the same engine modern Anki runs on. Cards come back right as you're about to forget them."
            />
            <Feature
              emoji="⚡"
              title="Quiz mode"
              body="Fast multiple-choice rounds for when you want momentum, not a marathon. Like Duolingo — minus the ads and the guilt-trips."
              tag="soon"
            />
            <Feature
              emoji="🤖"
              title="AI example sentences"
              body="Every word comes with a sentence pitched to its level, so it sticks in context — not in a vacuum. Written once by Claude, kept forever."
            />
            <Feature
              emoji="📱"
              title="Mobile-first, no ads"
              body="Thumb-friendly, made to fit between train stops. All ~8,800 words, N5 to N1, ready from day one."
            />
          </div>
        </section>

        {/* ── Why ────────────────────────────────────────────────── */}
        <section id="how" className="mx-auto w-full max-w-3xl px-5 py-14 text-center">
          <h2 className="text-[28px]" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
            The bit in between
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[16px]" style={{ color: "var(--ink-soft)" }}>
            <strong>Anki</strong>{" "}is incredibly powerful — and incredibly fiddly:
            decks, note types, add-ons, sync configs. <strong>Duolingo</strong>{" "}is fun
            until the ads, and it has no real JLPT track anyway. Bayana lives in the gap —
            open it, and study.{" "}
            <strong style={{ color: "var(--ink)" }}>That&apos;s the whole pitch.</strong>
          </p>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid var(--line)", background: "var(--surface-cream)" }}>
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-5 px-5 py-9 sm:flex-row sm:justify-between">
          {/* Brand + bilingual tagline */}
          <div className="flex flex-col items-center gap-1.5 sm:items-start">
            <span
              className="flex items-center gap-2 text-[18px]"
              style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}
            >
              <Parrot expr="happy" style={{ width: 28, height: 31 }} />
              <span>
                b<b style={{ color: "var(--mag-700)" }}>a</b>yana
              </span>
            </span>
            <span className="jp text-[13px]" style={{ color: "var(--ink-faint)" }}>
              毎日ちょっとずつ — a little every day
            </span>
          </div>

          {/* Credits — links share one consistent style */}
          <p className="text-center text-[13px] leading-relaxed sm:text-right" style={{ color: "var(--ink-soft)" }}>
            Built by{" "}
            <a
              href="https://chairulakmal.com"
              className="font-semibold underline decoration-2 underline-offset-2"
              style={{ color: "var(--grape)" }}
              target="_blank"
              rel="noopener noreferrer"
            >
              Chairul Akmal
            </a>
            <br />
            © {year} ·{" "}
            <a
              href="https://github.com/chairulakmal/bayana"
              className="font-semibold underline decoration-2 underline-offset-2"
              style={{ color: "var(--grape)" }}
              target="_blank"
              rel="noopener noreferrer"
            >
              MIT License
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

/** One feature card — white surface, rounded, with a soft brand shadow (BRAND.md §7). */
function Feature({
  emoji,
  title,
  body,
  tag,
}: {
  emoji: string;
  title: string;
  body: string;
  tag?: string;
}) {
  return (
    <div
      className="rounded-[var(--r-lg)] p-5"
      style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow)" }}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl" aria-hidden>
          {emoji}
        </span>
        {tag && (
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase"
            style={{ background: "var(--yellow)", color: "var(--ink)", letterSpacing: ".06em" }}
          >
            {tag}
          </span>
        )}
      </div>
      <h3 className="mt-3 text-[18px]" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
        {title}
      </h3>
      <p className="mt-1 text-[14px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
        {body}
      </p>
    </div>
  );
}
