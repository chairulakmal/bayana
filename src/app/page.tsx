import Link from "next/link";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/current-user";
import { Parrot } from "@/components/parrot";
import { InfoBubble } from "@/components/info-bubble";

// Public marketing homepage (BRAND.md). Its single job is to turn a visitor into someone
// studying, so the primary CTA is "Try the demo": Bayana is invite-only, and a visitor
// without an invite previously had nothing to click but a sign-in form that would reject
// them. The demo path (SPEC §11.8) needs no email, so it belongs in the hero rather than
// hidden below the fold of /auth/signin.
//
// Already signed in? Straight to /home, the app's default page. `getOptionalUser` (not
// `auth()`) is deliberate: it also recognises the signed demo cookie, so a returning demo
// visitor is sent to the app instead of being shown this marketing page again. `/` itself
// stays public (see proxy.ts).
//
// Page order is a funnel: what it is (hero) → proof it's real (deck stats) → what you
// actually do (modes) → what makes it different (AI sentence sample) → how it fits together
// (three steps) → why it exists (the gap between Anki and Duolingo) → one last CTA.

/** Deck size, from `decks/*.csv` (8,101 imported Word rows) and the seeded N3 grammar deck.
 *  Kept here as named constants so the copy below can't drift from the real numbers the way
 *  the previous hardcoded "~8,800 words" claim had. */
const WORD_COUNT = "8,100+";
const GRAMMAR_POINT_COUNT = 220;

export default async function Home() {
  const user = await getOptionalUser();
  if (user) redirect("/home");

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

      <main className="flex-1">
        {/* ── Hero ─────────────────────────────────────────────────── */}
        <section className="mx-auto grid w-full max-w-5xl items-center gap-10 px-5 pt-8 pb-14 md:grid-cols-2 md:pt-16">
          <div className="text-center md:text-left">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-semibold"
              style={{
                background: "var(--cream)",
                color: "var(--ink)",
                fontFamily: "var(--f-display)",
                letterSpacing: ".05em",
              }}
            >
              JLPT N5 → N1 · <span lang="ja" className="jp">毎日ちょっとずつ</span>
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
              Ten words at a time, two minutes a day. Real spaced repetition with an AI example
              sentence for every word, so nothing is memorised in a vacuum. No decks to build,
              no ads to dodge.{" "}
              <InfoBubble label="How the study pace works">
                <strong style={{ color: "var(--ink)" }}>Two bite-sized paces.</strong>
                <br />
                🎴 <strong style={{ color: "var(--ink)" }}>Flashcard</strong> — 10 new words a
                day. A pace you can keep, so reviews don&apos;t snowball.
                <br />
                ⚡ <strong style={{ color: "var(--ink)" }}>Quiz</strong> — 10 cards a session. A
                quick round for momentum.
                <br />
                <span lang="ja" className="jp">毎日ちょっとずつ</span> — a little every day.
              </InfoBubble>
            </p>

            {/* Primary CTA: the demo, because it is the only door a visitor without an invite
                can walk through. A form POST rather than a link, because the route is
                POST-only on purpose: a state-changing GET can be fired cross-site by an
                <img> tag or triggered by link prefetching (SPEC §11.8). Both buttons share
                btn-lg so they match in height. */}
            <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row">
              <form method="post" action="/api/demo/login" className="w-full sm:w-auto">
                <button type="submit" className="btn btn-primary btn-lg w-full">
                  Try the demo →
                </button>
              </form>
              <Link href="/auth/signin" className="btn btn-ghost btn-lg w-full sm:w-auto">
                Sign in
              </Link>
            </div>

            <p className="mt-4 text-[13px]" style={{ color: "var(--ink-faint)" }}>
              No sign-up, no email. Demo progress lives in your browser for 7 days.
              <br />
              <span style={{ color: "var(--ink-faint)" }}>
                A personal, invite-only project, built in the open on{" "}
                <a
                  href="https://github.com/chairulakmal/bayana"
                  className="font-semibold underline decoration-2 underline-offset-2"
                  style={{ color: "var(--grape)" }}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </a>
                .
              </span>
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

        {/* ── Proof strip ────────────────────────────────────────────
            Concrete numbers, immediately after the pitch. "Ready from day one" is a claim;
            a real deck size is evidence. Sits on a cream band so it reads as one unit. */}
        <section
          style={{
            background: "var(--surface-cream)",
            borderTop: "1px solid var(--line)",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-6 px-5 py-8 sm:grid-cols-4">
            <Metric value={WORD_COUNT} label="words, N5 to N1" />
            <Metric value="5" label="JLPT levels" />
            <Metric value={String(GRAMMAR_POINT_COUNT)} label="N3 grammar points" />
            <Metric value="FSRS" label="the scheduler Anki uses" />
          </div>
        </section>

        {/* ── Modes ──────────────────────────────────────────────────
            All four study modes. Exam and Grammar shipped after this page was first written
            and were never added, so the landing under-sold the app by half. */}
        <section className="mx-auto w-full max-w-5xl px-5 pt-14">
          <h2
            className="text-center text-[28px]"
            style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}
          >
            Four ways to study
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-[16px]" style={{ color: "var(--ink-soft)" }}>
            Same deck, four different demands on your memory. Pick whichever one you have the
            energy for today.
          </p>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Feature
              emoji="🎴"
              title="Flashcards"
              body="Real spaced repetition, powered by FSRS, the same engine modern Anki runs on. Cards come back right as you're about to forget them."
            />
            <Feature
              emoji="⚡"
              title="Quiz"
              body="Fast multiple-choice rounds for when you want momentum, not a marathon. Wrong answers get a shrug, not a lecture."
            />
            <Feature
              emoji="📝"
              title="Exam"
              body="JLPT-style 漢字の読み方 and 漢字の書き方 sections, with distractors picked to be genuinely confusable. A benchmark, not a grind."
            />
            <Feature
              emoji="✏️"
              title="Grammar"
              body={`${GRAMMAR_POINT_COUNT} N3 grammar points on their own review schedule, so patterns and vocabulary never compete for the same session.`}
            />
          </div>
        </section>

        {/* ── AI sentence showcase ───────────────────────────────────
            The actual differentiator, shown rather than described: a mock of the flashcard
            reveal (BRAND.md §7 "Flashcard"). An illustrative sample, not live data. */}
        <section className="mx-auto w-full max-w-5xl px-5 pt-16">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-[28px]" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
                Every word arrives in a sentence
              </h2>
              <p className="mt-3 text-[16px]" style={{ color: "var(--ink-soft)" }}>
                A word on its own is a translation to memorise. A word in a sentence is
                grammar, register, and collocation you absorb for free. Every one of the{" "}
                {WORD_COUNT} words has an example sentence pitched to its own JLPT level,
                written once by Claude and cached, so it is identical every time you see it and
                costs nothing to show again.
              </p>
            </div>

            {/* Flashcard mock. aria-hidden on the decorative label only; the content itself
                is real text so it stays readable to a screen reader in document order. */}
            <div
              className="rounded-[var(--r-lg)] p-6"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                boxShadow: "var(--shadow)",
              }}
            >
              <div className="flex items-center justify-between">
                <span className="chip chip-n3">N3</span>
                <span className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
                  example card
                </span>
              </div>
              <p lang="ja" className="jp mt-4 text-[40px] leading-tight" style={{ fontWeight: 800 }}>
                約束
              </p>
              <p lang="ja" className="jp mt-1 text-[18px]" style={{ color: "var(--mag-500)", fontWeight: 700 }}>
                やくそく
              </p>
              <p className="mt-1 text-[16px]" style={{ color: "var(--ink)" }}>
                a promise; an appointment
              </p>
              <div
                className="mt-4 rounded-[var(--r-md)] px-4 py-3"
                style={{ background: "var(--surface-cream)", border: "1px solid var(--line)" }}
              >
                <p lang="ja" className="jp text-[17px] leading-relaxed">
                  明日の<u>約束</u>を忘れないでください。
                </p>
                <p className="mt-1.5 text-[14px]" style={{ color: "var(--ink-soft)" }}>
                  Please don&apos;t forget tomorrow&apos;s appointment.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ───────────────────────────────────────────
            Three steps, because "spaced repetition" is jargon to most visitors and the
            mode cards above don't explain how a session actually begins. */}
        <section className="mx-auto w-full max-w-5xl px-5 pt-16">
          <h2
            className="text-center text-[28px]"
            style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}
          >
            How it works
          </h2>
          <ol className="mt-7 grid gap-4 sm:grid-cols-3">
            <Step
              n={1}
              title="Pick a level"
              body="One tap, N5 to N1. Everything (cards, quizzes, distractors) scopes to it, and you can switch whenever you like."
            />
            <Step
              n={2}
              title="Study for two minutes"
              body="Ten new words a day, plus whatever is due. The home screen tells you what's waiting, so there is nothing to configure."
            />
            <Step
              n={3}
              title="Let FSRS do the rest"
              body="Each answer reschedules the card for the moment you're about to forget it. Remember it easily, and you won't see it for months."
            />
          </ol>
        </section>

        {/* ── Why ────────────────────────────────────────────────────
            The positioning argument. Kept from the original page: it is the clearest
            statement of why this exists at all. */}
        <section id="how" className="mx-auto w-full max-w-3xl px-5 pt-16 pb-4 text-center">
          <h2 className="text-[28px]" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
            The bit in between
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[16px]" style={{ color: "var(--ink-soft)" }}>
            <strong>Anki</strong> is incredibly powerful, and incredibly fiddly: decks, note
            types, add-ons, sync configs. <strong>Duolingo</strong> is fun until the ads, and it
            has no real JLPT track anyway. Bayana lives in the gap. Open it, and study.{" "}
            <strong style={{ color: "var(--ink)" }}>That&apos;s the whole pitch.</strong>
          </p>
        </section>

        {/* ── Closing CTA ────────────────────────────────────────────
            A reader who scrolled this far shouldn't have to scroll back up to act. */}
        <section className="mx-auto w-full max-w-5xl px-5 py-14">
          <div
            className="flex flex-col items-center gap-5 rounded-[var(--r-lg)] px-6 py-10 text-center"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              boxShadow: "var(--shadow)",
            }}
          >
            <Parrot expr="wink" title="Pī, winking" style={{ width: 72, height: 80 }} />
            <div>
              <h2 className="text-[26px]" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
                <span lang="ja" className="jp">
                  始めましょう
                </span>{" "}
                · give it two minutes
              </h2>
              <p className="mt-2 text-[15px]" style={{ color: "var(--ink-soft)" }}>
                The demo is the real app, with the full deck. Nothing to install, nothing to
                fill in.
              </p>
            </div>
            <form method="post" action="/api/demo/login">
              <button type="submit" className="btn btn-primary btn-lg">
                Try the demo →
              </button>
            </form>
          </div>
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
            <span lang="ja" className="jp text-[13px]" style={{ color: "var(--ink-faint)" }}>
              毎日ちょっとずつ — a little every day
            </span>
          </div>

          {/* Credits, links sharing one consistent style */}
          <p
            className="text-center text-[13px] leading-relaxed sm:text-right"
            style={{ color: "var(--ink-soft)" }}
          >
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
            <br />© {year} ·{" "}
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

/**
 * One number in the proof strip.
 *
 * Plain divs, not a `<dl>`: the earlier version paired an `sr-only` `<dt>` with a `<dd>` that
 * also rendered the label visibly, so a screen reader announced every label twice. The
 * value and label already read correctly in document order, and these stats are decorative
 * reinforcement of the copy rather than a genuine term/definition list.
 */
function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <span
        className="block text-[30px] leading-none"
        style={{ fontFamily: "var(--f-display)", fontWeight: 700, color: "var(--mag-600)" }}
      >
        {value}
      </span>
      <span className="mt-1.5 block text-[13px]" style={{ color: "var(--ink-soft)" }}>
        {label}
      </span>
    </div>
  );
}

/** One feature card: white surface, rounded, with a soft brand shadow (BRAND.md §7). */
function Feature({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <div
      className="rounded-[var(--r-lg)] p-5"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow)",
      }}
    >
      <span className="text-2xl" aria-hidden>
        {emoji}
      </span>
      <h3 className="mt-3 text-[18px]" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
        {title}
      </h3>
      <p className="mt-1 text-[14px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
        {body}
      </p>
    </div>
  );
}

/** One numbered step in "How it works". The number is decorative; the heading carries order. */
function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li
      className="rounded-[var(--r-lg)] p-5"
      style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full text-[17px]"
        style={{
          background: "var(--yellow)",
          color: "var(--ink)",
          fontFamily: "var(--f-display)",
          fontWeight: 700,
        }}
        aria-hidden
      >
        {n}
      </span>
      <h3 className="mt-3 text-[18px]" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
        {title}
      </h3>
      <p className="mt-1 text-[14px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
        {body}
      </p>
    </li>
  );
}
