"use client";

// Quiz mode screen (SPEC §8.2). One JP→EN multiple-choice question at a time:
// tap an option → instant feedback (correct = green, wrong = coral, correct answer always
// revealed) + the cached example sentence → Continue → next. A round is a fixed batch
// (default 10); the summary shows the score. Non-scheduling — nothing here writes FSRS
// state. Minimal animation beyond the brand button press (SPEC §8.2; respects reduced-motion
// via the .opt/.btn classes).
//
// **The first round is built by the server** (`app/quiz/page.tsx`) and arrives in `initial`, so
// this component has no loading state and never fetches on mount. It keeps `load` for the
// imperative refetch only ("Play again" and the retry after a failed one), which stays a `GET`
// route handler (§14.16).
//
// The question type comes from `@/lib/quiz` rather than being re-declared here. It used to be a
// hand-written local mirror of the same shape, which is the drift the shared module exists to
// prevent: the builder and the renderer now cannot disagree about what a question is.

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Parrot } from "@/components/parrot";
import { SessionHeader, SessionHeaderLink } from "@/components/session-header";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useFocusOnTransition } from "@/hooks/use-focus-on-transition";
// `import type`, and it matters: `lib/quiz` imports `lib/db`, so importing any *value* from it
// here would pull Prisma and `pg` into the browser bundle (the build fails outright on
// `node:module`). A type import is erased at compile time and costs nothing.
import type { QuizQuestion } from "@/lib/quiz";

export function QuizSession({
  level,
  initial,
}: {
  level: string;
  /** The first round, built during the page render. See `app/quiz/page.tsx`. */
  initial: QuizQuestion[];
}) {
  // Seeded from the server render, so there is no null state and no first paint without
  // questions. `useState` initialisers only run on mount, which is correct rather than a hazard
  // here: nothing revalidates `/quiz` underneath a round in progress (§9.2).
  const [questions, setQuestions] = useState<QuizQuestion[]>(initial);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null); // chosen option index, once answered
  const [score, setScore] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Distinguishes "refetch failed" from "this level has too few words": both leave the round with
  // nothing to show, but they need different screens, and a failure must offer a retry rather
  // than claiming the deck is too small. Only a *refetch* can set this now, since a failed first build
  // throws during the server render and is caught by `app/quiz/error.tsx`.
  const [loadFailed, setLoadFailed] = useState(false);

  // `load` is only ever called imperatively now ("Play again", retry), which is exactly why it
  // needs a request token rather than an effect-cleanup `cancelled` flag: there is no effect to
  // clean up, and a user can tap twice. Each call takes its own id and a response applies state
  // only if it is still the most recent one in flight.
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      // No `count` param, deliberately. The round size has exactly one definition,
      // `buildQuizRound`'s default, and omitting it here is what keeps that true; passing a
      // literal `10` would have been a third copy of a number the server already knows.
      const res = await fetch(`/api/quiz?level=${encodeURIComponent(level)}`);
      if (!res.ok) throw new Error(`quiz ${res.status}`);
      const data: { questions: QuizQuestion[] } = await res.json();
      if (requestIdRef.current !== requestId) return;
      setQuestions(data.questions);
      setIndex(0);
      setPicked(null);
      setScore(0);
      setError(null);
      setLoadFailed(false);
    } catch {
      if (requestIdRef.current !== requestId) return;
      setError("Couldn't load the quiz.");
      setLoadFailed(true);
      // `questions` is left alone deliberately: a failed refetch must not discard the round that
      // is already on screen, and the retry screen below is what the user sees meanwhile.
    }
  }, [level]);

  // --- derived state and actions ---
  //
  // These sit above the early returns below rather than beside the markup that uses them,
  // because the keyboard and focus hooks close over them and hooks must run on every render (the
  // rules of hooks): a `useKeyboardShortcuts` call placed after an early return would silently
  // unbind itself on the summary screen.
  const total = questions.length;
  const current = index < total ? questions[index] : null;
  const answered = picked !== null;
  const correctIndex = current ? current.options.findIndex((o) => o.correct) : -1;

  // Self-guarding so the keyboard map can bind all four digits unconditionally: a "4"
  // pressed on a three-option question, or any key after the answer is in, is a no-op.
  // This guard is now load-bearing for pointer input too, since the options are no longer
  // `disabled` after an answer (see the footer).
  const choose = useCallback(
    (i: number) => {
      if (!current || picked !== null || i >= current.options.length) return;
      setPicked(i);
      if (current.options[i].correct) setScore((s) => s + 1);
    },
    [current, picked],
  );

  const next = useCallback(() => {
    setPicked(null);
    setIndex((i) => i + 1);
  }, []);

  // --- focus management (SPEC §8.4) ---
  //
  // Each transition swaps the footer contents, so without this focus lands on `<body>` and a
  // keyboard user re-Tabs from the top of the document on every question. Targets follow the rule
  // documented in `use-focus-on-transition.ts`: the Continue button once answered, because that
  // is the single next step and Space on it does the safe thing; the prompt when a fresh question
  // appears, because the next step is a *choice* and focusing option 1 would let a reflexive
  // Space answer the question; the score on the summary, which is the "you are here" line.
  const promptRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const summaryRef = useRef<HTMLParagraphElement>(null);
  const focusTarget = current === null ? summaryRef : answered ? continueRef : promptRef;
  useFocusOnTransition(focusTarget, `${index}:${answered}`);

  // --- keyboard shortcuts (SPEC §8.4) ---
  //
  // Digits pick an option, Space/Enter continues once answered. Disabled on the retry, empty
  // and summary screens, all of which set `current` to null or take an early return.
  useKeyboardShortcuts(
    {
      "1": () => choose(0),
      "2": () => choose(1),
      "3": () => choose(2),
      "4": () => choose(3),
      space: answered ? next : undefined,
      enter: answered ? next : undefined,
    },
    current !== null && !loadFailed,
  );

  // --- render states ---
  //
  // There is no loading branch. The first round arrives as a prop, and the wait that used to live
  // here is now `<Suspense>`'s fallback in `app/quiz/page.tsx` (`SessionLoading`).

  // Refetch failure. Only reachable from `load`: a failed *first* build throws on the server and
  // lands in `app/quiz/error.tsx` instead.
  if (loadFailed) {
    return (
      <Centered>
        <Parrot expr="sleepy" title="Pī looking concerned" style={{ width: 124, height: 138 }} />
        <p className="mt-4 text-2xl" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
          Couldn&apos;t load
        </p>
        <p className="mt-1" style={{ color: "var(--ink-soft)" }}>
          {error ?? "Something went wrong loading the quiz."}
        </p>
        <div className="mt-6 flex gap-3">
          <button onClick={() => void load()} className="btn btn-primary">
            Try again
          </button>
          <Link href="/home" className="btn btn-ghost">
            Home
          </Link>
        </div>
      </Centered>
    );
  }

  // Genuinely too few words at this level to form a question. `buildQuiz` returns [] rather
  // than throwing for this case, so it is a state and not an error.
  if (total === 0) {
    return (
      <Centered>
        <Parrot expr="sleepy" style={{ width: 110, height: 123 }} />
        <p className="mt-4 text-xl" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
          No quiz available
        </p>
        <p className="mt-1" style={{ color: "var(--ink-soft)" }}>
          Not enough words at this level yet.
        </p>
        <Link href="/home" className="btn btn-primary mt-6">
          Back home
        </Link>
      </Centered>
    );
  }

  // Round complete → summary. Branching on `current` rather than on `index >= total`
  // (the two are equivalent here) is what narrows `current` to non-null for the rest of
  // the function, so the active-question markup below needs no assertion.
  if (current === null) {
    return (
      <Centered>
        <Parrot expr="wow" title="Pī cheering" style={{ width: 124, height: 138 }} />
        {/* tabIndex={-1} makes this focusable by script but not by Tab. The standard way to
            land a screen reader on "where you now are" without adding a tab stop that does
            nothing. */}
        <p
          ref={summaryRef}
          tabIndex={-1}
          className="mt-4 text-3xl"
          style={{ fontFamily: "var(--f-display)", fontWeight: 700 }}
        >
          {score} / {total} 🎉
        </p>
        <p className="mt-1" style={{ color: "var(--ink-soft)" }}>
          Nice warm-up! <span lang="ja" className="jp">おつかれさま</span>
        </p>
        <div className="mt-6 flex gap-3">
          <button onClick={() => void load()} className="btn btn-primary">
            Play again
          </button>
          <Link href="/home" className="btn btn-ghost">
            Home
          </Link>
        </div>
        {/* Always-mounted `role="alert"`: "Play again" is live on this screen, so a failed
            refetch that lands back here needs somewhere to say so. */}
        <div role="alert">
          {error && (
            <p className="mt-3 text-sm" style={{ color: "var(--bad)" }}>
              {error}
            </p>
          )}
        </div>
      </Centered>
    );
  }

  return (
    <main className="flex h-svh flex-col pt-safe">
      {/* Progress + exit to the home hub */}
      <SessionHeader
        progress={Math.round((index / total) * 100)}
        level={level}
        left={
          <>
            <SessionHeaderLink href="/home">Home</SessionHeaderLink>
            <span className="mx-2">·</span>
            {total - index} left
          </>
        }
      />

      {/* Prompt: word in the top section; sentence revealed here after answering.
          "What does this mean?" is hidden once answered — no longer relevant. */}
      <section className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
        {/* The focus anchor for a fresh question. It wraps the prompt rather than being an empty
            sentinel so that focusing it reads out the question the user is being asked. */}
        <div
          ref={promptRef}
          tabIndex={-1}
          className="my-auto flex w-full flex-col items-center text-center"
        >
          {!answered && (
            <p className="text-[13px]" style={{ color: "var(--ink-faint)" }}>
              What does this mean?
            </p>
          )}
          <div lang="ja" className={answered ? "jp text-6xl" : "jp mt-3 text-6xl"} style={{ fontWeight: 700, color: "var(--ink)", lineHeight: 1.1 }}>
            {current.expression}
          </div>
          {answered && (
            <div lang="ja" className="jp mt-2 text-xl" style={{ color: "var(--mag-600)", fontWeight: 700 }}>
              {current.reading}
            </div>
          )}
          {answered && current.sentence && (
            <div className="mt-4 w-full max-w-md rounded-[var(--r-md)] p-3 text-left" style={{ background: "var(--surface-cream)" }}>
              <p lang="ja" className="jp text-[15px] leading-relaxed" style={{ color: "var(--ink)" }}>
                {current.sentence.japanese}
              </p>
              <p lang="ja" className="jp mt-1 text-[13px]" style={{ color: "var(--ink-faint)" }}>
                {current.sentence.reading}
              </p>
              <p className="mt-2 text-[13px] italic" style={{ color: "var(--ink-soft)" }}>
                {current.sentence.english}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Options + Continue */}
      <footer
        className="mx-auto w-full max-w-md shrink-0 px-3 pt-2"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
      >
        {/* Screen-reader announcement of the answer result. The ✓/✕ glyphs below are
            aria-hidden (they'd read as noise per option), so this live region is the
            SR-facing feedback. It must exist BEFORE its content changes — conditionally
            mounting an aria-live node often goes unannounced — hence always rendered. */}
        <div role="status" className="sr-only">
          {answered &&
            (picked === correctIndex
              ? "Correct!"
              : `Incorrect. The correct answer is: ${current.options[correctIndex].meaning}.`)}
        </div>
        <div className="flex flex-col gap-2">
          {current.options.map((o, i) => {
            let cls = "opt";
            if (answered && i === correctIndex) cls += " opt-correct";
            else if (answered && i === picked) cls += " opt-wrong";
            return (
              // `aria-disabled`, not `disabled`. A real `disabled` was blurring the option the
              // moment it was answered, which dropped focus to <body> on every question (SPEC
              // §8.4); it also removed the answered options from the tab order mid-round, so a
              // screen-reader user could no longer review what the choices had been. This keeps
              // them announced as unavailable while `choose`'s own guard ignores the click.
              <button
                key={i}
                className={cls}
                aria-disabled={answered}
                onClick={() => choose(i)}
              >
                {/* Keycap and label are grouped so .opt keeps exactly two flex children.
                    Its `justify-content: space-between` is what pins the ✓/✕ to the right
                    edge, and a third top-level child would push the label to the middle. */}
                <span className="flex min-w-0 items-center gap-2">
                  <span className="kbd-hint" aria-hidden>
                    {i + 1}
                  </span>
                  <span>{o.meaning}</span>
                </span>
                {answered && i === correctIndex && <span aria-hidden>✓</span>}
                {answered && i === picked && i !== correctIndex && <span aria-hidden>✕</span>}
              </button>
            );
          })}
        </div>
        {answered && (
          <button ref={continueRef} onClick={next} className="btn btn-primary mt-3 w-full">
            {index + 1 === total ? "See results" : "Continue"}
            <span className="kbd-hint" aria-hidden>
              Space
            </span>
          </button>
        )}
      </footer>
    </main>
  );
}

// Full-screen centered container for empty / retry / summary states (paper + ink).
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 text-center pt-safe pb-safe">
      {children}
    </main>
  );
}
