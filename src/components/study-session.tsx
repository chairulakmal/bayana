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

// --- shapes returned by GET /api/cards/queue ---
type QueueWord = {
  id: string;
  expression: string;
  reading: string;
  meaning: string;
  sentences: { japanese: string; reading: string; english: string }[];
};
type QueueResponse = { due: { word: QueueWord }[]; newWords: QueueWord[] };

// A normalized card for the session.
type StudyCard = {
  wordId: string;
  expression: string;
  reading: string;
  meaning: string;
  sentence: { japanese: string; reading: string; english: string } | null;
};

type Rating = 1 | 2 | 3 | 4;

const RATINGS: { value: Rating; label: string; className: string }[] = [
  { value: 1, label: "Again", className: "bg-rose-600 active:bg-rose-700" },
  { value: 2, label: "Hard", className: "bg-amber-600 active:bg-amber-700" },
  { value: 3, label: "Good", className: "bg-emerald-600 active:bg-emerald-700" },
  { value: 4, label: "Easy", className: "bg-sky-600 active:bg-sky-700" },
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

export function StudySession() {
  const [cards, setCards] = useState<StudyCard[] | null>(null); // null = still loading
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false); // disables controls during a request
  const [reviewed, setReviewed] = useState<string[]>([]); // wordIds, for undo
  const [error, setError] = useState<string | null>(null);

  // Load the queue once and flatten due + new into one ordered list.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/cards/queue");
        if (!res.ok) throw new Error(`queue ${res.status}`);
        const data: QueueResponse = await res.json();
        setCards([...data.due.map((d) => toCard(d.word)), ...data.newWords.map(toCard)]);
      } catch {
        setError("Couldn't load your study queue.");
        setCards([]);
      }
    })();
  }, []);

  const current = cards && index < cards.length ? cards[index] : null;

  const rate = useCallback(
    async (rating: Rating) => {
      if (!current || busy) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/review", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ wordId: current.wordId, rating }),
        });
        if (!res.ok) throw new Error(`review ${res.status}`);
        setReviewed((r) => [...r, current.wordId]);
        setIndex((i) => i + 1);
        setFlipped(false);
      } catch {
        setError("Failed to save your review.");
      } finally {
        setBusy(false);
      }
    },
    [current, busy],
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
    return <Centered>Loading…</Centered>;
  }

  if (!current) {
    return (
      <Centered>
        <p className="text-2xl font-semibold">🎉 All caught up!</p>
        <p className="mt-2 text-slate-500">No cards due right now.</p>
        {reviewed.length > 0 && (
          <button onClick={undo} disabled={busy} className="mt-6 text-sky-600 underline">
            Undo last
          </button>
        )}
      </Centered>
    );
  }

  const remaining = cards.length - index;

  return (
    <main className="flex min-h-dvh flex-col bg-white text-slate-900">
      {/* Top bar: progress + undo */}
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-3 text-sm text-slate-500">
        <span>{remaining} left</span>
        <button
          onClick={undo}
          disabled={busy || reviewed.length === 0}
          className="rounded px-2 py-1 underline disabled:opacity-30"
        >
          Undo
        </button>
      </header>

      {/* Card: tap anywhere to reveal the answer */}
      <button
        type="button"
        onClick={() => !flipped && setFlipped(true)}
        className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 text-center"
      >
        <div className="text-5xl font-bold tracking-tight">{current.expression}</div>

        {flipped ? (
          <div className="flex flex-col items-center gap-3">
            <div className="text-2xl text-slate-700">{current.reading}</div>
            <div className="text-xl text-slate-900">{current.meaning}</div>
            {current.sentence && (
              <div className="mt-2 border-t border-slate-200 pt-3 text-base text-slate-600">
                <p className="text-lg text-slate-800">{current.sentence.japanese}</p>
                <p className="text-sm text-slate-500">{current.sentence.reading}</p>
                <p className="mt-1 italic">{current.sentence.english}</p>
              </div>
            )}
          </div>
        ) : (
          <span className="text-sm text-slate-400">Tap to reveal</span>
        )}
      </button>

      {error && <p className="px-4 pb-2 text-center text-sm text-rose-600">{error}</p>}

      {/* Footer: rating buttons appear once flipped */}
      <footer className="mx-auto w-full max-w-md p-3">
        {flipped ? (
          <div className="grid grid-cols-4 gap-2">
            {RATINGS.map((r) => (
              <button
                key={r.value}
                onClick={() => rate(r.value)}
                disabled={busy}
                className={`min-h-14 rounded-xl text-sm font-semibold text-white disabled:opacity-50 ${r.className}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={() => setFlipped(true)}
            className="min-h-14 w-full rounded-xl bg-slate-900 text-sm font-semibold text-white active:bg-slate-700"
          >
            Show answer
          </button>
        )}
      </footer>
    </main>
  );
}

// Simple full-screen centered container for loading / empty / done states.
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-white px-6 text-center text-slate-900">
      {children}
    </main>
  );
}
