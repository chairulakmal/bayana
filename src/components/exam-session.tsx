"use client";

// Exam mode screen (SPEC §8.6). JLPT-style two-section round:
//
//   問題１ (reading) — sentence with kanji word underlined; pick the kana reading.
//   問題２ (writing) — sentence with kana word underlined; pick the kanji form.
//
// Sequential with immediate feedback (one question at a time, like Quiz mode) because
// instant correction is more valuable for learning than the test-paper submit-all format.
//
// Non-scheduling: no FSRS writes. Exam is a benchmark, not a study scheduler.
// Modes are independent by design — see SPEC §8.6.
//
// **The first round is built by the server** (`app/exam/page.tsx`) and arrives in `initial`, so
// this component has no loading state and never fetches on mount. It keeps `load` for the
// imperative refetch only ("Try again" from the summary, and the retry after a failed one).
//
// The question types come from `@/lib/exam` rather than being re-declared here; the local copies
// were a hand-written mirror of the same three types, which is exactly the drift the shared module
// prevents. Note the section boundary is recovered from question *order* (`writingStart` below),
// which is why `buildExamRound` owns the split for both callers.

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Parrot } from "@/components/parrot";
import { SessionHeader, SessionHeaderLink } from "@/components/session-header";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useFocusOnTransition } from "@/hooks/use-focus-on-transition";
// `import type`, and it matters: `lib/exam` imports `lib/db`, so importing a *value* from it here
// would pull Prisma and `pg` into the browser bundle. A type import is erased at compile time.
import type { ExamQuestion } from "@/lib/exam";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ExamSession({
  level,
  initial,
}: {
  level: string;
  /** The first round, built during the page render. See `app/exam/page.tsx`. */
  initial: ExamQuestion[];
}) {
  // Seeded from the server render: no null state, no first paint without questions.
  const [questions, setQuestions] = useState<ExamQuestion[]>(initial);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [readingScore, setReadingScore] = useState(0);
  const [writingScore, setWritingScore] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // showBreak is true after the last 問題１ question, before the first 問題２ question.
  const [showBreak, setShowBreak] = useState(false);
  // Separates "refetch failed" from "this level has too few words"; see quiz-session.tsx. A failed
  // *first* build throws during the server render and lands in `app/exam/error.tsx`.
  const [loadFailed, setLoadFailed] = useState(false);

  // Request token for the imperative refetch, because a user can tap "Try again" twice and a stale
  // response must not overwrite a newer one. See quiz-session.tsx for the full reasoning.
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      // No `count` param, deliberately: `buildExamRound`'s default is the single definition of a
      // round's size, and a literal here would be a second copy of it. See quiz-session.tsx.
      const res = await fetch(`/api/exam?level=${encodeURIComponent(level)}`);
      if (!res.ok) throw new Error(`exam ${res.status}`);
      const data: { questions: ExamQuestion[] } = await res.json();
      if (requestIdRef.current !== requestId) return;
      setQuestions(data.questions);
      setIndex(0);
      setPicked(null);
      setReadingScore(0);
      setWritingScore(0);
      setShowBreak(false);
      setError(null);
      setLoadFailed(false);
    } catch {
      if (requestIdRef.current !== requestId) return;
      setError("Couldn't load the exam.");
      setLoadFailed(true);
    }
  }, [level]);

  // --- Derived state and actions ---
  //
  // Hoisted above the early returns because the keyboard and focus hooks close over them and
  // have to run on every render.
  const total = questions.length;
  // The split point is where 問題２ begins (first writing question index).
  const writingStart = questions.findIndex((q) => q.type === "writing");
  // If all questions are one type, writingStart is -1 — treat as past the end.
  const readingTotal = writingStart === -1 ? total : writingStart;
  const writingTotal = total - readingTotal;

  const current = index < total ? questions[index] : null;
  const answered = picked !== null;
  const correctIndex = current ? current.options.findIndex((o) => o.correct) : -1;

  // Self-guarding, so the keyboard map can bind all four digits unconditionally. Now also the
  // guard for pointer input, since answered options are no longer `disabled` (see the footer).
  const choose = useCallback(
    (i: number) => {
      if (!current || picked !== null || i >= current.options.length) return;
      setPicked(i);
      if (current.options[i].correct) {
        if (current.type === "reading") setReadingScore((s) => s + 1);
        else setWritingScore((s) => s + 1);
      }
    },
    [current, picked],
  );

  const next = useCallback(() => {
    setPicked(null);
    const nextIndex = index + 1;
    // Trigger the section break when crossing from reading to writing.
    if (writingStart !== -1 && nextIndex === writingStart) {
      setShowBreak(true);
    }
    setIndex(nextIndex);
  }, [index, writingStart]);

  // --- Focus management (SPEC §8.4) ---
  //
  // Targets follow the rule in `use-focus-on-transition.ts`: a button only where the next step is
  // a single unambiguous one, an anchor where it is a choice. Exam has one target the other modes
  // do not: the section break's "Start 問題２" button, which is the clearest case of all, since
  // the break screen exists to be acknowledged and holds exactly one control.
  const promptRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const summaryRef = useRef<HTMLHeadingElement>(null);
  const breakRef = useRef<HTMLButtonElement>(null);
  const focusTarget = showBreak
    ? breakRef
    : current === null
      ? summaryRef
      : answered
        ? continueRef
        : promptRef;
  useFocusOnTransition(focusTarget, `${index}:${answered}:${showBreak}`);

  // --- Keyboard shortcuts (SPEC §8.4) ---
  //
  // The section break gets Space/Enter too. Without it the keyboard flow would hit a wall
  // exactly once per round, halfway through, which is worse than having no shortcuts at
  // all: the user learns the keys, then gets stranded on a screen that ignores them.
  useKeyboardShortcuts(
    showBreak
      ? {
          space: () => setShowBreak(false),
          enter: () => setShowBreak(false),
        }
      : {
          "1": () => choose(0),
          "2": () => choose(1),
          "3": () => choose(2),
          "4": () => choose(3),
          space: answered ? next : undefined,
          enter: answered ? next : undefined,
        },
    current !== null && !loadFailed,
  );

  // --- Empty / retry states ---
  //
  // There is no loading branch; the wait is now `<Suspense>`'s fallback in `app/exam/page.tsx`.

  if (loadFailed) {
    return (
      <Centered>
        <Parrot expr="sleepy" title="Pī looking concerned" style={{ width: 124, height: 138 }} />
        {/* One <h1> per branch, per the pattern documented in study-session.tsx. */}
        <h1 className="mt-4 text-2xl" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
          Couldn&apos;t load
        </h1>
        <p className="mt-1" style={{ color: "var(--ink-soft)" }}>
          {error ?? "Something went wrong loading the exam."}
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

  // Too few words at this level to form a round. `buildExam` returns [] rather than throwing
  // for this case, so it is a state and not an error.
  if (total === 0) {
    return (
      <Centered>
        <Parrot expr="sleepy" style={{ width: 110, height: 123 }} />
        <h1 className="mt-4 text-xl" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
          No exam available
        </h1>
        <p className="mt-1" style={{ color: "var(--ink-soft)" }}>
          Not enough words at this level yet.
        </p>
        <Link href="/home" className="btn btn-primary mt-6">
          Back home
        </Link>
      </Centered>
    );
  }

  // --- Section break screen between 問題１ and 問題２ ---

  if (showBreak) {
    return (
      <Centered>
        {/* No fontFamily override here. It used to force --f-display, but Fredoka carries
            no CJK glyphs at all, so 問題２ silently fell through the stack to system-ui:
            the section header was the one heading not in the brand's Japanese face. The
            .jp class alone is correct. Weight is 700, the heaviest JP weight the app
            loads — see BRAND.md §4 on why a third Japanese weight is not worth its cost. */}
        <h1 lang="ja" className="jp text-5xl" style={{ fontWeight: 700, color: "var(--ink)" }}>
          問題２
        </h1>
        <p className="mt-2 text-[15px]" style={{ color: "var(--ink-soft)" }}>
          <span lang="ja" className="jp">漢字の書き方</span> — pick the kanji form
        </p>
        <p className="mt-4 text-2xl" style={{ fontFamily: "var(--f-display)", fontWeight: 700 }}>
          <span lang="ja" className="jp">問題１</span> score: {readingScore} / {readingTotal}
        </p>
        <button
          ref={breakRef}
          onClick={() => setShowBreak(false)}
          className="btn btn-primary mt-6"
        >
          Start <span lang="ja" className="jp">問題２</span>
          <span className="kbd-hint" aria-hidden>
            Space
          </span>
        </button>
      </Centered>
    );
  }

  // --- Summary screen ---
  //
  // Branching on `current` rather than `index >= total` (equivalent here) narrows it to
  // non-null for the active-question markup below, which would otherwise need an assertion
  // now that `current` is computed up top for the keyboard hook.

  if (current === null) {
    const totalScore = readingScore + writingScore;
    return (
      <Centered>
        <Parrot expr="wow" title="Pī cheering" style={{ width: 124, height: 138 }} />
        {/* tabIndex={-1}: focusable by script, not by Tab. See quiz-session.tsx. */}
        <h1
          ref={summaryRef}
          tabIndex={-1}
          className="mt-4 text-3xl"
          style={{ fontFamily: "var(--f-display)", fontWeight: 700 }}
        >
          {totalScore} / {total} 🎉
        </h1>
        <div className="mt-3 flex flex-col gap-1 text-[14px]" style={{ color: "var(--ink-soft)" }}>
          <p>
            <span lang="ja" className="jp">問題１ 読み方：</span>
            {readingScore} / {readingTotal}
          </p>
          {writingTotal > 0 && (
            <p>
              <span lang="ja" className="jp">問題２ 書き方：</span>
              {writingScore} / {writingTotal}
            </p>
          )}
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={() => void load()} className="btn btn-primary">
            Try again
          </button>
          <Link href="/home" className="btn btn-ghost">
            Home
          </Link>
        </div>
        {/* Always-mounted `role="alert"`: "Try again" is live here, so a failed refetch that
            lands back on this screen needs somewhere to say so. */}
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

  // --- Active question ---

  // Determine display question number within its section.
  const sectionLabel = current.type === "reading" ? "問題１" : "問題２";
  const questionNum =
    current.type === "reading" ? index + 1 : index - readingTotal + 1;
  const sectionTotal = current.type === "reading" ? readingTotal : writingTotal;

  // Prompt wording differs by question type. Split into its Japanese and English halves
  // rather than one string: the two need different faces (BRAND.md §4, Japanese always
  // renders in --f-jp, even inline within English), and a single string can only carry one.
  const promptJa = current.type === "reading" ? "どう読みますか？" : "どう書きますか？";
  const promptEn =
    current.type === "reading"
      ? "How is the underlined word read?"
      : "What is the kanji for the underlined word?";

  return (
    <main className="flex h-svh flex-col pt-safe">
      <h1 className="sr-only">Exam · {level}</h1>
      <SessionHeader
        progress={Math.round((index / total) * 100)}
        level={level}
        left={
          <>
            <SessionHeaderLink href="/home">Home</SessionHeaderLink>
            <span className="mx-2">·</span>
            <span lang="ja" className="jp">{sectionLabel}</span>
            <span className="mx-1 text-[var(--ink-faint)]">·</span>
            {questionNum}/{sectionTotal}
          </>
        }
      />

      <section className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
        {/* Focus anchor for a fresh question; wraps the prompt so focusing it reads out what is
            being asked rather than landing on an empty sentinel. */}
        <div
          ref={promptRef}
          tabIndex={-1}
          className="my-auto flex w-full flex-col items-center text-center"
        >
          {/* Question type label */}
          <p
            lang="ja" className="jp text-[13px] font-semibold"
            style={{ color: "var(--ink-faint)", letterSpacing: ".06em" }}
          >
            {sectionLabel} {current.type === "reading" ? "読み方" : "書き方"}
          </p>

          {/* Prompt instruction — hidden once answered (no longer the focus) */}
          {!answered && (
            <p className="mt-1 text-[12px]" style={{ color: "var(--ink-faint)" }}>
              <span lang="ja" className="jp">{promptJa}</span> ({promptEn})
            </p>
          )}

          {/* Sentence with target word underlined */}
          <div
            lang="ja" className="jp mt-4 w-full max-w-md rounded-[var(--r-md)] p-4 text-left text-[18px] leading-relaxed"
            style={{ background: "var(--surface-cream)", color: "var(--ink)" }}
          >
            <HighlightedSentence sentence={current.sentence} target={current.target} />
          </div>

          {/* Answer reveal + sentence reading/translation — shown after answering */}
          {answered && (
            <div className="mt-3 w-full max-w-md">
              {/* Correct answer in magenta */}
              <p lang="ja" className="jp text-center text-xl" style={{ color: "var(--mag-600)", fontWeight: 700 }}>
                {current.options[correctIndex].text}
              </p>
              {/* Word meaning */}
              <p className="mt-1 text-center text-[13px]" style={{ color: "var(--ink-soft)" }}>
                {current.meaning}
              </p>
              {/* Sentence reading and English translation, same panel style as Quiz mode */}
              {(current.sentenceReading || current.sentenceEnglish) && (
                <div
                  className="mt-3 rounded-[var(--r-md)] p-3 text-left"
                  style={{ background: "var(--surface-cream)" }}
                >
                  {current.sentenceReading && (
                    <p lang="ja" className="jp text-[13px]" style={{ color: "var(--ink-faint)" }}>
                      {current.sentenceReading}
                    </p>
                  )}
                  {current.sentenceEnglish && (
                    <p className="mt-1 text-[13px] italic" style={{ color: "var(--ink-soft)" }}>
                      {current.sentenceEnglish}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <footer
        className="mx-auto w-full max-w-md shrink-0 px-3 pt-2"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
      >
        {/* Screen-reader announcement of the answer result (see quiz-session.tsx for
            why this live region is always mounted rather than conditional). */}
        <div role="status" className="sr-only">
          {answered &&
            (picked === correctIndex
              ? "Correct!"
              : `Incorrect. The correct answer is: ${current.options[correctIndex].text}.`)}
        </div>
        <div className="flex flex-col gap-2">
          {current.options.map((o, i) => {
            let cls = "opt";
            if (answered && i === correctIndex) cls += " opt-correct";
            else if (answered && i === picked) cls += " opt-wrong";
            return (
              // `aria-disabled`, not `disabled`; see quiz-session.tsx for why (a real `disabled`
              // blurred the option on answer, dropping focus to <body> every question).
              <button
                key={i}
                lang="ja"
                className={`${cls} jp`}
                aria-disabled={answered}
                onClick={() => choose(i)}
              >
                {/* Grouped so .opt keeps two flex children (see quiz-session.tsx). */}
                <span className="flex min-w-0 items-center gap-2">
                  <span className="kbd-hint" aria-hidden>
                    {i + 1}
                  </span>
                  <span>{o.text}</span>
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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Renders a Japanese sentence with the target word underlined in magenta.
 *
 * Tries progressively shorter prefixes of `target` to handle conjugated verb forms —
 * the AI sentence for 食べる might say 食べました, so searching for the full 食べる fails,
 * but 食べ succeeds and still highlights the kanji clearly. Single-character words like
 * 尾 are also matched (minimum prefix length is 1). If nothing matches, the sentence is
 * shown without any highlight.
 */
function HighlightedSentence({ sentence, target }: { sentence: string; target: string }) {
  let matchStart = -1;
  let matchLen = 0;
  for (let len = target.length; len >= 1; len--) {
    const idx = sentence.indexOf(target.slice(0, len));
    if (idx !== -1) {
      matchStart = idx;
      matchLen = len;
      break;
    }
  }

  if (matchStart === -1) {
    return <span>{sentence}</span>;
  }

  const underlineStyle: React.CSSProperties = {
    textDecoration: "underline",
    textDecorationThickness: "2px",
    textUnderlineOffset: "4px",
    fontWeight: 700,
    color: "var(--mag-600)",
  };

  return (
    <>
      <span>{sentence.slice(0, matchStart)}</span>
      <span style={underlineStyle}>{sentence.slice(matchStart, matchStart + matchLen)}</span>
      <span>{sentence.slice(matchStart + matchLen)}</span>
    </>
  );
}

/** Full-screen centered container for empty / retry / summary / break states. */
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 text-center pt-safe pb-safe">
      {children}
    </main>
  );
}
