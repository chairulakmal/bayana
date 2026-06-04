"use client";

// Quiz mode screen (SPEC §8.2). One JP→EN multiple-choice question at a time:
// tap an option → instant feedback (correct = green, wrong = coral, correct answer always
// revealed) + the cached example sentence → Continue → next. A round is a fixed batch
// (default 10); the summary shows the score. Non-scheduling — nothing here writes FSRS
// state. Minimal animation beyond the brand button press (SPEC §8.2; respects reduced-motion
// via the .opt/.btn classes).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Parrot } from "@/components/parrot";

type Option = { meaning: string; correct: boolean };
type Question = {
  wordId: string;
  expression: string;
  reading: string;
  sentence: { japanese: string; reading: string; english: string } | null;
  options: Option[];
};

export function QuizSession({ level }: { level: string }) {
  const [questions, setQuestions] = useState<Question[] | null>(null); // null = loading
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null); // chosen option index, once answered
  const [score, setScore] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setQuestions(null);
    setIndex(0);
    setPicked(null);
    setScore(0);
    setError(null);
    try {
      const res = await fetch(`/api/quiz?level=${encodeURIComponent(level)}&count=10`);
      if (!res.ok) throw new Error(`quiz ${res.status}`);
      const data: { questions: Question[] } = await res.json();
      setQuestions(data.questions);
    } catch {
      setError("Couldn't load the quiz.");
      setQuestions([]);
    }
  }, [level]);

  useEffect(() => {
    // load() is async — setState only runs after awaiting fetch, not synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // --- render states ---

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
          No quiz available
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

  // Round complete → summary.
  if (index >= total) {
    return (
      <Centered>
        <Parrot expr="wow" title="Pī cheering" style={{ width: 124, height: 138 }} />
        <p className="mt-4 text-3xl" style={{ fontFamily: "var(--f-display)", fontWeight: 700 }}>
          {score} / {total} 🎉
        </p>
        <p className="mt-1" style={{ color: "var(--ink-soft)" }}>
          Nice warm-up! <span className="jp">おつかれさま</span>
        </p>
        <div className="mt-6 flex gap-3">
          <button onClick={() => void load()} className="btn btn-primary">
            Play again
          </button>
          <Link href="/home" className="btn btn-ghost">
            Home
          </Link>
        </div>
      </Centered>
    );
  }

  const current = questions[index];
  const answered = picked !== null;
  const correctIndex = current.options.findIndex((o) => o.correct);

  const choose = (i: number) => {
    if (answered) return;
    setPicked(i);
    if (current.options[i].correct) setScore((s) => s + 1);
  };
  const next = () => {
    setPicked(null);
    setIndex((i) => i + 1);
  };

  return (
    <main className="flex min-h-dvh flex-col">
      {/* Progress + exit to the home hub */}
      <header className="mx-auto w-full max-w-md px-4 pt-4">
        <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: "var(--cream-100)" }}>
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${Math.round((index / total) * 100)}%`, background: "linear-gradient(90deg, var(--magenta), var(--mag-500))" }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[13px]" style={{ color: "var(--ink-soft)" }}>
          <span>
            {index + 1} / {total}
          </span>
          <Link href="/home" className="font-semibold underline underline-offset-2" style={{ color: "var(--grape)" }}>
            Home
          </Link>
        </div>
      </header>

      {/* Prompt: the Japanese word (kanji if present); reading + sentence reveal on answer */}
      <section className="flex flex-1 flex-col items-center justify-center px-4 py-4 text-center">
        <p className="text-[13px]" style={{ color: "var(--ink-faint)" }}>
          What does this mean?
        </p>
        <div className="jp mt-3 text-6xl" style={{ fontWeight: 800, color: "var(--ink)", lineHeight: 1.1 }}>
          {current.expression}
        </div>
        {answered && (
          <div className="jp mt-2 text-xl" style={{ color: "var(--mag-600)", fontWeight: 700 }}>
            {current.reading}
          </div>
        )}
        {answered && current.sentence && (
          <div className="mt-4 w-full max-w-md rounded-[var(--r-md)] p-3 text-left" style={{ background: "var(--surface-cream)" }}>
            <p className="jp text-[15px] leading-relaxed" style={{ color: "var(--ink)" }}>
              {current.sentence.japanese}
            </p>
            <p className="mt-1 text-[13px] italic" style={{ color: "var(--ink-soft)" }}>
              {current.sentence.english}
            </p>
          </div>
        )}
      </section>

      {/* Options + Continue */}
      <footer className="mx-auto w-full max-w-md p-3">
        <div className="flex flex-col gap-2">
          {current.options.map((o, i) => {
            let cls = "opt";
            if (answered && i === correctIndex) cls += " opt-correct";
            else if (answered && i === picked) cls += " opt-wrong";
            return (
              <button key={i} className={cls} disabled={answered} onClick={() => choose(i)}>
                <span>{o.meaning}</span>
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

// Full-screen centered container for loading / empty / summary states (paper + ink).
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      {children}
    </main>
  );
}
