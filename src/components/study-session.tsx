"use client";

// Anki-mode study screen (Phase 1a, JP→EN).
//
// Flow: load the queue once → show one card at a time → tap to flip (reveal reading,
// meaning, example sentence) → rate Again/Hard/Good/Easy → advance. Undo reverts the
// last rating. Mobile-first: single centered card, full-width thumb-reachable controls.
//
// The session's card list is fixed at load time, so "undo" simply steps back to the
// previous card to be re-rated; newly-due cards appear on the next load.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Parrot } from "@/components/parrot";

// --- shapes returned by GET /api/cards/queue ---
type QueueWord = {
  id: string;
  expression: string;
  reading: string;
  meaning: string;
  sentences: { japanese: string; reading: string; english: string }[];
};
type QueueResponse = { due: { word: QueueWord }[]; newWords: QueueWord[]; totalDue: number };

// A normalized card for the session.
type StudyCard = {
  wordId: string;
  expression: string;
  reading: string;
  meaning: string;
  sentence: { japanese: string; reading: string; english: string } | null;
};

type Rating = 1 | 2 | 3 | 4;

const RATINGS: { value: Rating; label: string; cls: string }[] = [
  { value: 1, label: "Again", cls: "rate-again" },
  { value: 2, label: "Hard", cls: "rate-hard" },
  { value: 3, label: "Good", cls: "rate-good" },
  { value: 4, label: "Easy", cls: "rate-easy" },
];

function toCard(word: QueueWord): StudyCard {
  const s = word.sentences[0] ?? null;
  return {
    wordId: word.id,
    expression: word.expression,
    reading: word.reading,
    meaning: word.meaning,
    sentence: s ? { japanese: s.japanese, reading: s.reading, english: s.english } : null,
  };
}

export function StudySession({ level }: { level: string }) {
  const [cards, setCards] = useState<StudyCard[] | null>(null); // null = still loading
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false); // disables controls during a request
  const [reviewed, setReviewed] = useState<string[]>([]); // wordIds, for undo
  const [error, setError] = useState<string | null>(null);
  // sessionDone: true after the last card is rated — shows the session-complete screen
  // instead of immediately auto-loading the next batch. remainingDue is the totalDue
  // count from the last queue fetch (pre-cap), used for the "N more waiting" hint.
  const [sessionDone, setSessionDone] = useState(false);
  const [remainingDue, setRemainingDue] = useState(0);

  // Fetch the queue and flatten due + new into one ordered list. Called on mount and
  // again whenever a batch is exhausted (auto-refetch), so cards that have become due
  // mid-session — e.g. a card you rated "Again", or a learning-step card — cycle back
  // without a manual reload.
  const loadQueue = useCallback(async () => {
    try {
      const res = await fetch(`/api/cards/queue?level=${encodeURIComponent(level)}`);
      if (!res.ok) throw new Error(`queue ${res.status}`);
      const data: QueueResponse = await res.json();
      setCards([...data.due.map((d) => toCard(d.word)), ...data.newWords.map(toCard)]);
      setRemainingDue(data.totalDue);
      setIndex(0);
      setReviewed([]);
      setFlipped(false);
      setSessionDone(false);
      setError(null);
    } catch {
      setError("Couldn't load your study queue.");
      setCards((prev) => prev ?? []); // first-load failure ⇒ show the empty state
    }
  }, [level]);

  useEffect(() => {
    // loadQueue() is async — setState only runs after awaiting fetch, not synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadQueue();
  }, [loadQueue]);

  const current = cards && index < cards.length ? cards[index] : null;

  const rate = useCallback(
    async (rating: Rating) => {
      if (!current || !cards || busy) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/review", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ wordId: current.wordId, rating }),
        });
        if (!res.ok) throw new Error(`review ${res.status}`);

        if (index >= cards.length - 1) {
          // Last card in the session → show the session-complete screen. The user
          // chooses whether to start another session or go home. We don't auto-refetch
          // so there's a clear stopping point (FSRS sessions should feel finite).
          setSessionDone(true);
        } else {
          setReviewed((r) => [...r, current.wordId]);
          setIndex((i) => i + 1);
          setFlipped(false);
        }
      } catch {
        setError("Failed to save your review.");
      } finally {
        setBusy(false);
      }
    },
    [current, cards, index, busy],
  );

  const undo = useCallback(async () => {
    if (busy || reviewed.length === 0) return;
    setBusy(true);
    setError(null);
    const wordId = reviewed[reviewed.length - 1];
    try {
      const res = await fetch("/api/review/undo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wordId }),
      });
      if (!res.ok) throw new Error(`undo ${res.status}`);
      setReviewed((r) => r.slice(0, -1));
      setIndex((i) => Math.max(0, i - 1));
      setFlipped(false);
    } catch {
      setError("Failed to undo.");
    } finally {
      setBusy(false);
    }
  }, [busy, reviewed]);

  // --- render states ---

  if (cards === null) {
    return (
      <Centered>
        <Parrot expr="sleepy" style={{ width: 84, height: 94 }} />
        <p className="mt-3" style={{ color: "var(--ink-soft)" }}>
          Loading…
        </p>
      </Centered>
    );
  }

  // Session-complete: shown after rating the last card in a capped batch (sessionDone),
  // or when the queue is genuinely empty (!current after a fetch).
  if (sessionDone || !current) {
    // "All caught up" only when the queue came back empty (not when we just hit the cap).
    const allCaughtUp = !sessionDone;
    // remainingDue is totalDue from the last fetch; subtract the session size for an
    // estimate. "Again" cards may have cycled back in, so we call it approximate.
    const approxRemaining = Math.max(0, remainingDue - (cards?.length ?? 0));
    return (
      <Centered>
        <Parrot
          expr={allCaughtUp ? "wow" : "happy"}
          title={allCaughtUp ? "Pī cheering" : "Pī smiling"}
          style={{ width: 124, height: 138 }}
        />
        <p className="mt-4 text-2xl" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
          {allCaughtUp ? "All caught up! 🎉" : "Session done! 🎉"}
        </p>
        <p className="mt-1" style={{ color: "var(--ink-soft)" }}>
          {allCaughtUp ? (
            <>No cards are due right now. <span className="jp">またね！</span></>
          ) : approxRemaining > 0 ? (
            <>About {approxRemaining} more cards due today.</>
          ) : (
            <>All caught up! <span className="jp">おつかれさま</span></>
          )}
        </p>
        <div className="mt-6 flex gap-3">
          <button onClick={() => void loadQueue()} disabled={busy} className="btn btn-primary">
            {allCaughtUp ? "Check for more" : "Another session?"}
          </button>
          <Link href="/home" className="btn btn-ghost">
            Home
          </Link>
        </div>
        {error && (
          <p className="mt-3 text-sm" style={{ color: "var(--bad)" }}>
            {error}
          </p>
        )}
      </Centered>
    );
  }

  const remaining = cards.length - index;
  const progress = cards.length ? Math.round((index / cards.length) * 100) : 0;

  return (
    <main className="flex min-h-dvh flex-col">
      {/* Top bar: progress bar + count + undo */}
      <header className="mx-auto w-full max-w-md px-4 pt-4">
        <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: "var(--cream-100)" }}>
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${progress}%`, background: "linear-gradient(90deg, var(--magenta), var(--mag-500))" }}
          />
        </div>
        <div className="mt-2 flex items-center text-[13px]" style={{ color: "var(--ink-soft)" }}>
          <span className="flex-1">
            <Link href="/home" className="font-semibold underline underline-offset-2" style={{ color: "var(--grape)" }}>
              Home
            </Link>
            <span className="mx-2" style={{ color: "var(--ink-faint)" }}>·</span>
            {remaining} left
          </span>
          {/* Level chip — centred; uses the brand chip palette at a smaller scale so it
              reads as context without pulling focus during recall */}
          <span
            className={`chip chip-${level.toLowerCase()}`}
            style={{ fontSize: "10px", padding: "2px 8px" }}
          >
            {level}
          </span>
          <span className="flex flex-1 justify-end">
            <button
              onClick={undo}
              disabled={busy || reviewed.length === 0}
              className="font-semibold underline underline-offset-2 disabled:opacity-30"
              style={{ color: "var(--grape)" }}
            >
              Undo
            </button>
          </span>
        </div>
      </header>

      {/* Card: tap anywhere to reveal the answer (BRAND.md §7 flashcard) */}
      <section className="flex flex-1 items-center justify-center px-4 py-4">
        <button
          type="button"
          onClick={() => !flipped && setFlipped(true)}
          className="flex w-full max-w-md flex-col items-center justify-center gap-5 rounded-[var(--r-lg)] px-6 py-10 text-center"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow)",
            minHeight: "58dvh",
            cursor: flipped ? "default" : "pointer",
          }}
        >
          <div className="jp text-6xl" style={{ fontWeight: 800, color: "var(--ink)", lineHeight: 1.1 }}>
            {current.expression}
          </div>

          {flipped ? (
            <div className="flex w-full flex-col items-center gap-2">
              <div className="jp text-2xl" style={{ color: "var(--mag-600)", fontWeight: 700 }}>
                {current.reading}
              </div>
              <div className="text-xl" style={{ color: "var(--ink)" }}>
                {current.meaning}
              </div>
              {current.sentence && (
                <div
                  className="mt-3 w-full rounded-[var(--r-md)] p-4 text-left"
                  style={{ background: "var(--surface-cream)" }}
                >
                  <p className="jp text-[17px] leading-relaxed" style={{ color: "var(--ink)" }}>
                    {current.sentence.japanese}
                  </p>
                  <p className="jp mt-1 text-[13px]" style={{ color: "var(--ink-faint)" }}>
                    {current.sentence.reading}
                  </p>
                  <p className="mt-2 text-[14px] italic" style={{ color: "var(--ink-soft)" }}>
                    {current.sentence.english}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <span className="jp text-sm" style={{ color: "var(--ink-faint)" }}>
              タップして答え · tap to reveal
            </span>
          )}
        </button>
      </section>

      {error && (
        <p className="px-4 pb-2 text-center text-sm" style={{ color: "var(--bad)" }}>
          {error}
        </p>
      )}

      {/* Footer: rating buttons appear once flipped */}
      <footer className="mx-auto w-full max-w-md p-3">
        {flipped ? (
          <div className="grid grid-cols-4 gap-2">
            {RATINGS.map((r) => (
              <button key={r.value} onClick={() => rate(r.value)} disabled={busy} className={`rate ${r.cls}`}>
                {r.label}
              </button>
            ))}
          </div>
        ) : (
          <button onClick={() => setFlipped(true)} className="btn btn-primary w-full">
            Show answer
          </button>
        )}
      </footer>
    </main>
  );
}

// Full-screen centered container for loading / empty / done states (paper + ink).
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      {children}
    </main>
  );
}
