"use client";

// Grammar-mode study screen.
//
// Card shape: front shows the grammar pattern in Japanese; tap to reveal meanings
// (comma-separated), the Japanese example sentence, and its English translation.
// Same flip-and-rate loop as study-session.tsx but operates on GrammarPoint /
// GrammarProgress.
//
// **The first queue is built by the server** (`app/grammar/study/page.tsx`) and arrives in
// `initial`, so this component has no loading state and never fetches on mount. It keeps
// `loadQueue` for the imperative refetches only ("Check for more", "Another session?", and the
// retry after a failed refetch), which stay a `GET` route handler (§14.16). Writes go to the
// Server Actions in `app/grammar/actions.ts`.
//
// **Undo now exists here.** It was called a v1 omission on the grounds that grammar cards are
// lighter-weight, which did not survive examination: a mis-tapped "Easy" is exactly as
// unrecoverable as the last-card vocab case that was already worth fixing, and `u` was the one
// key where the two queues' shortcut maps disagreed, against the parity SPEC §8.4 calls
// deliberate. What it needed was somewhere to roll back *to*, since `GrammarProgress` stores only
// the latest state; `GrammarReviewLog` is that, and `undoLastGrammarReview` uses the same ts-fsrs
// `rollback()` vocab has always used.

import { useCallback, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Parrot } from "@/components/parrot";
import { SessionHeader, SessionHeaderLink, SessionHeaderButton } from "@/components/session-header";
import { HighlightedSentence } from "@/components/highlighted-sentence";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useFocusOnTransition } from "@/hooks/use-focus-on-transition";
import { rateGrammarPoint, undoGrammarRating } from "@/app/grammar/actions";
import type { GrammarCard, GrammarSessionPayload } from "@/lib/grammar-cards";

type Rating = 1 | 2 | 3 | 4;

const RATINGS: { value: Rating; label: string; cls: string }[] = [
  { value: 1, label: "Again", cls: "rate-again" },
  { value: 2, label: "Hard", cls: "rate-hard" },
  { value: 3, label: "Good", cls: "rate-good" },
  { value: 4, label: "Easy", cls: "rate-easy" },
];

export function GrammarSession({
  level,
  initial,
}: {
  level: string;
  /** The first session, built during the page render. See `app/grammar/study/page.tsx`. */
  initial: GrammarSessionPayload;
}) {
  // Seeded from the server render, so there is no null state and no first paint without cards.
  // `useState` initialisers only run on mount, which is correct here rather than a hazard: a
  // re-render with a fresh `initial` would mean the page had been revalidated underneath a
  // session in progress, and §9.2 states why neither grammar action revalidates.
  const [cards, setCards] = useState<GrammarCard[]>(initial.cards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState<string[]>([]); // grammarPointIds, for undo
  const [error, setError] = useState<string | null>(null);
  const [sessionDone, setSessionDone] = useState(false);
  const [totalDueAtLoad, setTotalDueAtLoad] = useState(initial.totalDue);
  // Only the due cards in this batch (not new points), so approxRemaining is exact rather than
  // the estimate vocab settles for; see the note in lib/grammar-cards.ts.
  const [dueCardsInSession, setDueCardsInSession] = useState(initial.dueCount);
  // Distinguishes "refetch failed" from "queue is genuinely empty": both can leave the session
  // with nothing to show, but they need different screens, and a failure must offer a retry
  // rather than claiming "All caught up!". Only a *refetch* can set this now: a failed first
  // build throws during the server render and is caught by `app/grammar/study/error.tsx`.
  const [loadFailed, setLoadFailed] = useState(false);
  // Ratings run inside a transition so the optimistic advance stays interruptible: React can
  // process the next card's keystroke while the previous write is still in flight.
  const [, startTransition] = useTransition();

  // loadQueue is only ever called imperatively now ("Check for more", "Another session?", retry),
  // which is exactly why it still needs a request token rather than an effect-cleanup `cancelled`
  // flag: there is no effect to clean up, and a user can tap twice. Each call takes its own id and
  // a response applies state only if it is still the most recent one in flight.
  const requestIdRef = useRef(0);

  const loadQueue = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      const res = await fetch(`/api/grammar/queue?level=${encodeURIComponent(level)}`);
      if (!res.ok) throw new Error(`queue ${res.status}`);
      // The route returns the same flattened payload this component was handed as `initial`, so
      // the two entry points cannot drift; it used to return raw Prisma rows that were normalized
      // here on arrival (lib/grammar-cards.ts).
      const data: GrammarSessionPayload = await res.json();
      if (requestIdRef.current !== requestId) return;
      setCards(data.cards);
      setTotalDueAtLoad(data.totalDue);
      setDueCardsInSession(data.dueCount);
      setIndex(0);
      setReviewed([]);
      setFlipped(false);
      setSessionDone(false);
      setError(null);
      setLoadFailed(false);
    } catch {
      if (requestIdRef.current !== requestId) return;
      setError("Couldn't load your grammar queue.");
      setLoadFailed(true);
      // `cards` is left alone on purpose: a failed refetch must not discard the session that is
      // already on screen, and the retry screen below is what the user sees meanwhile.
    }
  }, [level]);

  const current = index < cards.length ? cards[index] : null;

  const rate = useCallback(
    (rating: Rating) => {
      if (!current) return;
      // Snapshot both facts the rollback needs, before any state starts moving.
      const grammarPointId = current.grammarPointId;
      const wasLastCard = index >= cards.length - 1;

      // **Advance first, ask the server second**, matching study-session.tsx. Rating is the one
      // action a user performs twenty times in a row, and making each one wait on a round trip
      // made a session feel like it was buffering. All three pieces of state move now and are
      // rolled back together if the write fails.
      //
      // Advance uniformly, including on the last card, so `index` always equals the number of
      // cards rated and `reviewed` always holds every rated id. That invariant is what lets one
      // undo implementation serve both the header button and the completion screen.
      setReviewed((r) => [...r, grammarPointId]);
      setIndex((i) => i + 1);
      setFlipped(false);
      if (wasLastCard) {
        // Last card → the session-complete screen. No auto-refetch, so there is a clear stopping
        // point (FSRS sessions should feel finite).
        setSessionDone(true);
      }
      setError(null);

      startTransition(async () => {
        try {
          await rateGrammarPoint({ grammarPointId, rating });
        } catch {
          // Put the card back exactly as it was: same index, same history, and revealed, because
          // it was revealed at the moment it was rated.
          setReviewed((r) => r.slice(0, -1));
          setIndex((i) => Math.max(0, i - 1));
          setFlipped(true);
          if (wasLastCard) setSessionDone(false);
          setError("Failed to save your review.");
        }
      });
    },
    [current, cards.length, index],
  );

  // Undo keeps an in-flight guard even though rating no longer has one, and the asymmetry is the
  // point rather than an oversight. Two quick ratings hit two *different* cards, which is what
  // rapid-fire rating means and is now supported. Two quick undos hit the *same* card: the second
  // finds no log row left to roll back, so the action throws and the user is shown a failure for
  // something that did in fact work once. A ref, not state, so taking the guard costs no render;
  // the button's `disabled` stays tied to the history alone so it never flickers mid-tap.
  const undoing = useRef(false);

  // Deliberately not optimistic, unlike `rate`. Undo is a corrective action taken once, not on the
  // hot path, so the round trip is affordable, and rolling back a rollback is materially harder to
  // reason about than rolling back an advance.
  const undo = useCallback(async () => {
    if (undoing.current || reviewed.length === 0) return;
    undoing.current = true;
    setError(null);
    const grammarPointId = reviewed[reviewed.length - 1];
    try {
      await undoGrammarRating({ grammarPointId });
      setReviewed((r) => r.slice(0, -1));
      setIndex((i) => Math.max(0, i - 1));
      setFlipped(false);
      // Undoing from the completion screen re-opens the session on the last card (a no-op
      // mid-session, where sessionDone is already false).
      setSessionDone(false);
    } catch {
      setError("Failed to undo.");
    } finally {
      undoing.current = false;
    }
  }, [reviewed]);

  // --- focus management (SPEC §8.4) ---
  //
  // Rating unmounts the four rating buttons out from under the focused element, so focus fell to
  // `<body>` after every card. Targets follow the rule in `use-focus-on-transition.ts`.
  //
  // **The reveal deliberately moves nothing** (`flipped ? null : …`). Its next step is a *choice*
  // among four ratings, and focusing "Again" would let a reflexive second Space press bury a card
  // the user had not read, which is the hazard SPEC §14.18 declined Anki's Space-rates-Good binding to
  // avoid. Anchoring focus near the ratings instead was rejected for a second reason: the reveal
  // already fires a polite `role="status"` announcement of the answer, and moving focus in the same
  // commit can cut a screen reader off mid-sentence. Rating keys work from anywhere, so nothing is
  // lost by staying put.
  const showAnswerRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLParagraphElement>(null);
  const focusTarget = sessionDone || !current ? doneRef : flipped ? null : showAnswerRef;
  useFocusOnTransition(focusTarget, `${index}:${flipped}:${sessionDone}`);

  // --- keyboard shortcuts (SPEC §8.4) ---
  //
  // Now identical to study-session.tsx including `u`, which is the parity the map was always meant
  // to have: the whole value of a shortcut is that it transfers, and a learner moving between the
  // vocab and grammar queues in one sitting should not have to remember which one 3 means "Good"
  // in, or which one can take a mistake back.
  const cardVisible = current !== null && !sessionDone && !loadFailed;
  useKeyboardShortcuts(
    {
      space: flipped ? undefined : () => setFlipped(true),
      enter: flipped ? undefined : () => setFlipped(true),
      "1": flipped ? () => rate(1) : undefined,
      "2": flipped ? () => rate(2) : undefined,
      "3": flipped ? () => rate(3) : undefined,
      "4": flipped ? () => rate(4) : undefined,
      // No `flipped` guard: undo self-guards on its in-flight ref and an empty history, and the
      // whole point of undo is that it is reachable the instant you realise the mistake.
      u: () => void undo(),
    },
    cardVisible,
  );

  // --- render states ---
  //
  // There is no loading branch. The first queue arrives as a prop, and the wait that used to live
  // here is now `<Suspense>`'s fallback in `app/grammar/study/page.tsx` (`SessionLoading`).

  if (loadFailed && !sessionDone) {
    return (
      <Centered>
        <Parrot expr="sleepy" title="Pī looking concerned" style={{ width: 124, height: 138 }} />
        <p className="mt-4 text-2xl" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
          Couldn&apos;t load
        </p>
        <p className="mt-1" style={{ color: "var(--ink-soft)" }}>
          {error ?? "Something went wrong loading your grammar queue."}
        </p>
        <div className="mt-6 flex gap-3">
          <button onClick={() => void loadQueue()} className="btn btn-primary">
            Try again
          </button>
          <Link href="/grammar" className="btn btn-ghost">
            Back
          </Link>
        </div>
      </Centered>
    );
  }

  if (sessionDone || !current) {
    const allCaughtUp = !sessionDone;
    // approxRemaining = due cards that weren't in this session's batch. Only subtract the due
    // cards we loaded (not new points) from totalDue.
    const approxRemaining = Math.max(0, totalDueAtLoad - dueCardsInSession);
    return (
      <Centered>
        <Parrot
          expr={allCaughtUp ? "wow" : "happy"}
          title={allCaughtUp ? "Pī cheering" : "Pī smiling"}
          style={{ width: 124, height: 138 }}
        />
        {/* tabIndex={-1}: focusable by script, not by Tab. The standard way to land a screen
            reader on "where you now are" without adding a tab stop that does nothing. */}
        <p
          ref={doneRef}
          tabIndex={-1}
          className="mt-4 text-2xl"
          style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}
        >
          {allCaughtUp ? "All caught up! 🎉" : "Session done! 🎉"}
        </p>
        <p className="mt-1" style={{ color: "var(--ink-soft)" }}>
          {allCaughtUp ? (
            <>No grammar cards due right now. <span lang="ja" className="jp">またね！</span></>
          ) : approxRemaining > 0 ? (
            <>About {approxRemaining} more due today.</>
          ) : (
            <>All caught up! <span lang="ja" className="jp">おつかれさま</span></>
          )}
        </p>
        <div className="mt-6 flex gap-3">
          <button onClick={() => void loadQueue()} className="btn btn-primary">
            {allCaughtUp ? "Check for more" : "Another session?"}
          </button>
          <Link href="/grammar" className="btn btn-ghost">
            Back
          </Link>
        </div>
        {/* Escape hatch for a fat-fingered rating on the LAST card, matching study-session.tsx:
            without it that one mistake is the single unrecoverable rating in a session. */}
        {!allCaughtUp && reviewed.length > 0 && (
          <button onClick={() => void undo()} className="btn btn-ghost mt-3 text-sm">
            Undo last rating
          </button>
        )}
        {/* Always-mounted `role="alert"`, matching study-session.tsx: both "Check for more" and
            the undo button above are live on this screen, so a failure here is silent without it. */}
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

  const remaining = cards.length - index;
  const progress = cards.length ? Math.round((index / cards.length) * 100) : 0;

  // What the reveal announces (see the live region below). Mirrors what the card actually
  // renders, including the conditional reading: a kana-only pattern is its own reading, and
  // hearing it twice in a row is worse than not hearing it. The example sentence is left out
  // for the reason given at the same spot in study-session.tsx.
  const revealedAnswer =
    current.reading === current.pattern
      ? current.meanings.join(", ")
      : `${current.reading}. ${current.meanings.join(", ")}`;

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
        /* Undo advertises its shortcut via `title` rather than a .kbd-hint keycap, matching
           study-session.tsx: this pill is deliberately the quietest control on the screen
           (BRAND.md §7 session chrome), and a badge here would cost more than the hint is worth. */
        right={
          <SessionHeaderButton
            onClick={undo}
            disabled={reviewed.length === 0}
            title="Undo last rating (U)"
          >
            Undo
          </SessionHeaderButton>
        }
      />

      {/* Card area: scrollable so long example sentences don't overflow.
          A plain <div> with a tap-to-flip overlay rather than a wrapping <button>, for the
          three reasons documented at the same spot in study-session.tsx (selectable text,
          a sane screen-reader name, no inert control left behind after the flip). */}
      <section className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
        <div
          className="relative mx-auto my-auto flex w-full max-w-md flex-col items-center justify-center gap-5 rounded-[var(--r-lg)] px-6 py-10 text-center"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow)",
            minHeight: "55svh",
          }}
        >
          {/* Pointer-only tap-anywhere overlay; see study-session.tsx for why it is
              aria-hidden and untabbable rather than a second labelled control. */}
          {!flipped && (
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              onClick={() => setFlipped(true)}
              className="absolute inset-0 cursor-pointer rounded-[var(--r-lg)]"
            />
          )}

          {/* Front: grammar pattern in large Japanese type */}
          <div
            lang="ja" className="jp text-5xl"
            style={{ fontWeight: 700, color: "var(--ink)", lineHeight: 1.2 }}
          >
            {current.pattern}
          </div>

          {flipped ? (
            <div className="flex w-full flex-col items-center gap-3">
              {/* Reading (only shown if it differs from the pattern) */}
              {current.reading !== current.pattern && (
                <div lang="ja" className="jp text-xl" style={{ color: "var(--mag-600)", fontWeight: 700 }}>
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
                <p lang="ja" className="jp text-[17px] leading-relaxed" style={{ color: "var(--ink)" }}>
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
            <span lang="ja" className="jp text-sm" style={{ color: "var(--ink-faint)" }}>
              タップして答え · tap to reveal
            </span>
          )}
        </div>
      </section>

      {/* Reveal announcement and failure notice; both carry the reasoning at the matching spot
          in study-session.tsx. Kept identical to the vocab queue on purpose: the two screens are
          the same interaction, and a screen-reader user should not have to learn two of them. */}
      <div role="status" className="sr-only">
        {flipped ? revealedAnswer : ""}
      </div>

      <div role="alert">
        {error && (
          <p className="px-4 pb-1 text-center text-sm" style={{ color: "var(--bad)" }}>
            {error}
          </p>
        )}
      </div>

      <footer
        className="mx-auto w-full max-w-md shrink-0 px-3 pt-2"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
      >
        {flipped ? (
          <div className="grid grid-cols-4 gap-2">
            {RATINGS.map((r) => (
              // No `disabled` while a write is in flight, matching study-session.tsx: rating is
              // optimistic now, so rapid-fire rating is a supported interaction rather than
              // something to block. The SERIALIZABLE transaction in grammar-review.ts is what
              // keeps two concurrent writes for one card from losing an update.
              <button
                key={r.value}
                onClick={() => rate(r.value)}
                className={`rate ${r.cls}`}
              >
                {r.label}
                <span className="kbd-hint ml-1.5" aria-hidden>
                  {r.value}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <button ref={showAnswerRef} onClick={() => setFlipped(true)} className="btn btn-primary w-full">
            Show answer
            <span className="kbd-hint" aria-hidden>
              Space
            </span>
          </button>
        )}
      </footer>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 text-center pt-safe pb-safe">
      {children}
    </main>
  );
}
