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

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Parrot } from "@/components/parrot";
import { SessionHeader, SessionHeaderLink } from "@/components/session-header";

type Option = { text: string; correct: boolean };

type ReadingQuestion = {
  type: "reading";
  wordId: string;
  sentence: string;
  sentenceReading: string | null;
  sentenceEnglish: string | null;
  target: string;
  meaning: string;
  options: Option[];
};

type WritingQuestion = {
  type: "writing";
  wordId: string;
  sentence: string;
  sentenceReading: string | null;
  sentenceEnglish: string | null;
  target: string;
  meaning: string;
  options: Option[];
};

type ExamQuestion = ReadingQuestion | WritingQuestion;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ExamSession({ level }: { level: string }) {
  const [questions, setQuestions] = useState<ExamQuestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [readingScore, setReadingScore] = useState(0);
  const [writingScore, setWritingScore] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // showBreak is true after the last 問題１ question, before the first 問題２ question.
  const [showBreak, setShowBreak] = useState(false);

  const load = useCallback(async () => {
    setQuestions(null);
    setIndex(0);
    setPicked(null);
    setReadingScore(0);
    setWritingScore(0);
    setShowBreak(false);
    setError(null);
    try {
      const res = await fetch(`/api/exam?level=${encodeURIComponent(level)}&count=20`);
      if (!res.ok) throw new Error(`exam ${res.status}`);
      const data: { questions: ExamQuestion[] } = await res.json();
      setQuestions(data.questions);
    } catch {
      setError("Couldn't load the exam.");
      setQuestions([]);
    }
  }, [level]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // --- Loading / empty / error states ---

  if (questions === null) {
    return (
      <Centered>
        <Parrot expr="happy" style={{ width: 84, height: 94 }} />
        <p className="mt-3" style={{ color: "var(--ink-soft)" }}>
          Loading…
        </p>
      </Centered>
    );
  }

  if (questions.length === 0) {
    return (
      <Centered>
        <Parrot expr="sleepy" style={{ width: 110, height: 123 }} />
        <p className="mt-4 text-xl" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
          No exam available
        </p>
        <p className="mt-1" style={{ color: "var(--ink-soft)" }}>
          {error ?? "Not enough words at this level yet."}
        </p>
        <Link href="/home" className="btn btn-primary mt-6">
          Back home
        </Link>
      </Centered>
    );
  }

  const total = questions.length;
  // The split point is where 問題２ begins (first writing question index).
  const writingStart = questions.findIndex((q) => q.type === "writing");
  // If all questions are one type, writingStart is -1 — treat as past the end.
  const readingTotal = writingStart === -1 ? total : writingStart;
  const writingTotal = total - readingTotal;

  // --- Section break screen between 問題１ and 問題２ ---

  if (showBreak) {
    return (
      <Centered>
        <p
          className="jp text-5xl"
          style={{ fontFamily: "var(--f-display)", fontWeight: 800, color: "var(--ink)" }}
        >
          問題２
        </p>
        <p className="mt-2 text-[15px]" style={{ color: "var(--ink-soft)" }}>
          漢字の書き方 — pick the kanji form
        </p>
        <p className="mt-4 text-2xl" style={{ fontFamily: "var(--f-display)", fontWeight: 700 }}>
          問題１ score: {readingScore} / {readingTotal}
        </p>
        <button
          onClick={() => setShowBreak(false)}
          className="btn btn-primary mt-6"
        >
          Start 問題２
        </button>
      </Centered>
    );
  }

  // --- Summary screen ---

  if (index >= total) {
    const totalScore = readingScore + writingScore;
    return (
      <Centered>
        <Parrot expr="wow" title="Pī cheering" style={{ width: 124, height: 138 }} />
        <p className="mt-4 text-3xl" style={{ fontFamily: "var(--f-display)", fontWeight: 700 }}>
          {totalScore} / {total} 🎉
        </p>
        <div className="mt-3 flex flex-col gap-1 text-[14px]" style={{ color: "var(--ink-soft)" }}>
          <p>
            問題１ 読み方：{readingScore} / {readingTotal}
          </p>
          {writingTotal > 0 && (
            <p>
              問題２ 書き方：{writingScore} / {writingTotal}
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
      </Centered>
    );
  }

  // --- Active question ---

  const current = questions[index];
  const answered = picked !== null;
  const correctIndex = current.options.findIndex((o) => o.correct);

  const choose = (i: number) => {
    if (answered) return;
    setPicked(i);
    const correct = current.options[i].correct;
    if (correct) {
      if (current.type === "reading") setReadingScore((s) => s + 1);
      else setWritingScore((s) => s + 1);
    }
  };

  const next = () => {
    setPicked(null);
    const nextIndex = index + 1;
    // Trigger the section break when crossing from reading to writing.
    if (writingStart !== -1 && nextIndex === writingStart) {
      setShowBreak(true);
    }
    setIndex(nextIndex);
  };

  // Determine display question number within its section.
  const sectionLabel = current.type === "reading" ? "問題１" : "問題２";
  const questionNum =
    current.type === "reading" ? index + 1 : index - readingTotal + 1;
  const sectionTotal = current.type === "reading" ? readingTotal : writingTotal;

  // Prompt wording differs by question type.
  const prompt =
    current.type === "reading"
      ? "どう読みますか？ (How is the underlined word read?)"
      : "どう書きますか？ (What is the kanji for the underlined word?)";

  return (
    <main className="flex h-svh flex-col pt-safe">
      <SessionHeader
        progress={Math.round((index / total) * 100)}
        level={level}
        left={
          <>
            <SessionHeaderLink href="/home">Home</SessionHeaderLink>
            <span className="mx-2">·</span>
            <span className="jp">{sectionLabel}</span>
            <span className="mx-1 text-[var(--ink-faint)]">·</span>
            {questionNum}/{sectionTotal}
          </>
        }
      />

      <section className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
        <div className="my-auto flex w-full flex-col items-center text-center">
          {/* Question type label */}
          <p
            className="jp text-[13px] font-semibold"
            style={{ color: "var(--ink-faint)", letterSpacing: ".06em" }}
          >
            {sectionLabel} {current.type === "reading" ? "読み方" : "書き方"}
          </p>

          {/* Prompt instruction — hidden once answered (no longer the focus) */}
          {!answered && (
            <p className="mt-1 text-[12px]" style={{ color: "var(--ink-faint)" }}>
              {prompt}
            </p>
          )}

          {/* Sentence with target word underlined */}
          <div
            className="jp mt-4 w-full max-w-md rounded-[var(--r-md)] p-4 text-left text-[18px] leading-relaxed"
            style={{ background: "var(--surface-cream)", color: "var(--ink)" }}
          >
            <HighlightedSentence sentence={current.sentence} target={current.target} />
          </div>

          {/* Answer reveal + sentence reading/translation — shown after answering */}
          {answered && (
            <div className="mt-3 w-full max-w-md">
              {/* Correct answer in magenta */}
              <p className="jp text-center text-xl" style={{ color: "var(--mag-600)", fontWeight: 700 }}>
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
                    <p className="jp text-[13px]" style={{ color: "var(--ink-faint)" }}>
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
        <div className="flex flex-col gap-2">
          {current.options.map((o, i) => {
            let cls = "opt";
            if (answered && i === correctIndex) cls += " opt-correct";
            else if (answered && i === picked) cls += " opt-wrong";
            return (
              <button
                key={i}
                className={`${cls} jp`}
                disabled={answered}
                onClick={() => choose(i)}
              >
                <span>{o.text}</span>
                {answered && i === correctIndex && <span aria-hidden>✓</span>}
                {answered && i === picked && i !== correctIndex && <span aria-hidden>✕</span>}
              </button>
            );
          })}
        </div>
        {answered && (
          <button onClick={next} className="btn btn-primary mt-3 w-full">
            {index + 1 === total ? "See results" : "Continue"}
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

/** Full-screen centered container for loading / empty / summary / break states. */
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 text-center pt-safe pb-safe">
      {children}
    </main>
  );
}
