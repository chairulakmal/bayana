"use client";

// Grammar-mode study screen.
//
// Card shape: front shows the grammar pattern in Japanese; tap to reveal meanings
// (comma-separated), the Japanese example sentence, and its English translation.
// Same flip-and-rate loop as study-session.tsx but operates on GrammarPoint /
// GrammarProgress. No undo in v1 (grammar cards are lighter-weight).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Parrot } from "@/components/parrot";
import { SessionHeader, SessionHeaderLink } from "@/components/session-header";

// --- shapes returned by GET /api/grammar/queue ---

type GrammarPoint = {
  id: string;
  pattern: string;
  reading: string;
  meanings: string[];
  exampleJp: string;
  exampleEn: string;
  lesson: number;
};

type DueCard = { grammarPoint: GrammarPoint };
type QueueResponse = { due: DueCard[]; newPoints: GrammarPoint[]; totalDue: number };

// Normalized card for the session.
type GrammarCard = {
  grammarPointId: string;
  pattern: string;
  reading: string;
  meanings: string[];
  exampleJp: string;
  exampleEn: string;
};

type Rating = 1 | 2 | 3 | 4;

const RATINGS: { value: Rating; label: string; cls: string }[] = [
  { value: 1, label: "Again", cls: "rate-again" },
  { value: 2, label: "Hard", cls: "rate-hard" },
  { value: 3, label: "Good", cls: "rate-good" },
  { value: 4, label: "Easy", cls: "rate-easy" },
];

function toCard(point: GrammarPoint): GrammarCard {
  return {
    grammarPointId: point.id,
    pattern: point.pattern,
    reading: point.reading,
    meanings: point.meanings,
    exampleJp: point.exampleJp,
    exampleEn: point.exampleEn,
  };
}

export function GrammarSession({ level }: { level: string }) {
  const [cards, setCards] = useState<GrammarCard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionDone, setSessionDone] = useState(false);
  const [totalDueAtLoad, setTotalDueAtLoad] = useState(0);
  const [dueCardsInSession, setDueCardsInSession] = useState(0);

  const loadQueue = useCallback(async () => {
    try {
      const res = await fetch(`/api/grammar/queue?level=${encodeURIComponent(level)}`);
      if (!res.ok) throw new Error(`queue ${res.status}`);
      const data: QueueResponse = await res.json();
      const allCards = [
        ...data.due.map((d) => toCard(d.grammarPoint)),
        ...data.newPoints.map(toCard),
      ];
      setCards(allCards);
      setTotalDueAtLoad(data.totalDue);
      // Track only the due cards in this batch (not new points) so approxRemaining is correct.
      setDueCardsInSession(data.due.length);
      setIndex(0);
      setFlipped(false);
      setSessionDone(false);
      setError(null);
    } catch {
      setError("Couldn't load your grammar queue.");
      setCards((prev) => prev ?? []);
    }
  }, [level]);

  useEffect(() => {
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
        const res = await fetch("/api/grammar/review", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ grammarPointId: current.grammarPointId, rating }),
        });
        if (!res.ok) throw new Error(`review ${res.status}`);

        if (index >= cards.length - 1) {
          setSessionDone(true);
        } else {
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

  if (sessionDone || !current) {
    const allCaughtUp = !sessionDone;
    // approxRemaining = due cards that weren't in this session's batch.
    // Only subtract the due cards we loaded (not new points) from totalDue.
    const approxRemaining = Math.max(0, totalDueAtLoad - dueCardsInSession);
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
            <>No grammar cards due right now. <span className="jp">またね！</span></>
          ) : approxRemaining > 0 ? (
            <>About {approxRemaining} more due today.</>
          ) : (
            <>All caught up! <span className="jp">おつかれさま</span></>
          )}
        </p>
        <div className="mt-6 flex gap-3">
          <button onClick={() => void loadQueue()} disabled={busy} className="btn btn-primary">
            {allCaughtUp ? "Check for more" : "Another session?"}
          </button>
          <Link href="/grammar" className="btn btn-ghost">
            Back
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
    <main className="flex h-svh flex-col pt-safe">
      <SessionHeader
        progress={progress}
        level={level}
        left={
          <>
            <SessionHeaderLink href="/grammar">Grammar</SessionHeaderLink>
            <span className="mx-2">·</span>
            {remaining} left
          </>
        }
        right={null}
      />

      {/* Card area: scrollable so long example sentences don't overflow. */}
      <section className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
        <button
          type="button"
          onClick={() => !flipped && setFlipped(true)}
          className="my-auto flex w-full max-w-md flex-col items-center justify-center gap-5 rounded-[var(--r-lg)] px-6 py-10 text-center"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow)",
            minHeight: "55svh",
            cursor: flipped ? "default" : "pointer",
          }}
        >
          {/* Front: grammar pattern in large Japanese type */}
          <div
            className="jp text-5xl"
            style={{ fontWeight: 800, color: "var(--ink)", lineHeight: 1.2 }}
          >
            {current.pattern}
          </div>

          {flipped ? (
            <div className="flex w-full flex-col items-center gap-3">
              {/* Reading (only shown if it differs from the pattern) */}
              {current.reading !== current.pattern && (
                <div className="jp text-xl" style={{ color: "var(--mag-600)", fontWeight: 700 }}>
                  {current.reading}
                </div>
              )}

              {/* Meanings */}
              <div className="text-lg" style={{ color: "var(--ink)" }}>
                {current.meanings.join(", ")}
              </div>

              {/* Example sentence */}
              <div
                className="mt-2 w-full rounded-[var(--r-md)] p-4 text-left"
                style={{ background: "var(--surface-cream)" }}
              >
                <p className="jp text-[17px] leading-relaxed" style={{ color: "var(--ink)" }}>
                  <HighlightedSentence
                    sentence={current.exampleJp}
                    pattern={current.pattern}
                    reading={current.reading}
                  />
                </p>
                <p className="mt-2 text-[14px] italic" style={{ color: "var(--ink-soft)" }}>
                  {current.exampleEn}
                </p>
              </div>
            </div>
          ) : (
            <span className="jp text-sm" style={{ color: "var(--ink-faint)" }}>
              タップして答え · tap to reveal
            </span>
          )}
        </button>
      </section>

      {error && (
        <p className="px-4 pb-1 text-center text-sm" style={{ color: "var(--bad)" }}>
          {error}
        </p>
      )}

      <footer
        className="mx-auto w-full max-w-md shrink-0 px-3 pt-2"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
      >
        {flipped ? (
          <div className="grid grid-cols-4 gap-2">
            {RATINGS.map((r) => (
              <button
                key={r.value}
                onClick={() => void rate(r.value)}
                disabled={busy}
                className={`rate ${r.cls}`}
              >
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

/**
 * Render `sentence` with the first occurrence of `pattern` (or `reading` as a
 * fallback) wrapped in <strong>. If neither is found the sentence is returned as-is.
 * Simple substring match — good enough for the structured example sentences we seed.
 */
function HighlightedSentence({
  sentence,
  pattern,
  reading,
}: {
  sentence: string;
  pattern: string;
  reading: string;
}) {
  // Strip leading/trailing 〜 placeholders (e.g. "〜ために" → "ために") so the
  // pattern matches its conjugated form in the sentence rather than the bare stem notation.
  const stripped = pattern.replace(/^[〜～]+|[〜～]+$/g, "");
  // Try stripped pattern first, then the full pattern, then the kana reading.
  const needle = (stripped && sentence.includes(stripped))
    ? stripped
    : sentence.includes(pattern)
      ? pattern
      : sentence.includes(reading)
        ? reading
        : null;

  if (!needle) return <>{sentence}</>;

  const idx = sentence.indexOf(needle);
  const before = sentence.slice(0, idx);
  const match = sentence.slice(idx, idx + needle.length);
  const after = sentence.slice(idx + needle.length);

  return (
    <>
      {before}
      <strong style={{ color: "var(--grape)" }}>{match}</strong>
      {after}
    </>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 text-center pt-safe pb-safe">
      {children}
    </main>
  );
}
