"use client";

// Flashcard-mode study screen (Phase 1a, JP→EN).
//
// Flow: receive the first queue as a prop → show one card at a time → tap to flip (reveal
// reading, meaning, example sentence) → rate Again/Hard/Good/Easy → advance. Undo reverts the
// last rating. Mobile-first: single centered card, full-width thumb-reachable controls.
//
// The session's card list is fixed at load time, so "undo" simply steps back to the
// previous card to be re-rated; newly-due cards appear on the next load.
//
// **The first queue is built by the server** (`app/study/page.tsx`) and arrives in `initial`,
// so this component has no loading state and never fetches on mount. It keeps `loadQueue` for
// the imperative refetches only ("Check for more", "Another session?", and the retry after a
// failed refetch), which stay a `GET` route handler (§14.16). Writes go to the Server Actions
// in `app/study/actions.ts`.

import { useCallback, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Parrot } from "@/components/parrot";
import { SessionHeader, SessionHeaderLink, SessionHeaderButton } from "@/components/session-header";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useFocusOnTransition } from "@/hooks/use-focus-on-transition";
import { rateCard, undoRating } from "@/app/study/actions";
import type { StudyCard, StudySessionPayload } from "@/lib/study-cards";

type Rating = 1 | 2 | 3 | 4;

const RATINGS: { value: Rating; label: string; cls: string }[] = [
  { value: 1, label: "Again", cls: "rate-again" },
  { value: 2, label: "Hard", cls: "rate-hard" },
  { value: 3, label: "Good", cls: "rate-good" },
  { value: 4, label: "Easy", cls: "rate-easy" },
];

export function StudySession({
  level,
  initial,
}: {
  level: string;
  /** The first session, built during the page render. See `app/study/page.tsx`. */
  initial: StudySessionPayload;
}) {
  // Seeded from the server render, so there is no null state and no first paint without cards.
  // `useState` initialisers only run on mount, which is correct here rather than a hazard: a
  // re-render with a fresh `initial` would mean the page had been revalidated underneath a
  // session in progress, and §9.2 states why neither rating action revalidates `/study`.
  const [cards, setCards] = useState<StudyCard[]>(initial.cards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState<string[]>([]); // wordIds, for undo
  const [error, setError] = useState<string | null>(null);
  // sessionDone: true after the last card is rated — shows the session-complete screen
  // instead of immediately auto-loading the next batch. remainingDue is the totalDue
  // count from the last queue build (pre-cap), used for the "N more waiting" hint.
  const [sessionDone, setSessionDone] = useState(false);
  const [remainingDue, setRemainingDue] = useState(initial.totalDue);
  // Distinguishes "refetch failed" from "queue is genuinely empty": both can leave the
  // session with nothing to show, but they need different screens, and a failure must offer a
  // retry rather than claiming "All caught up!". Only a *refetch* can set this now: a failed
  // first build throws during the server render and is caught by `app/study/error.tsx`.
  const [loadFailed, setLoadFailed] = useState(false);
  // Ratings run inside a transition so the optimistic advance stays interruptible: React can
  // process the next card's keystroke while the previous write is still in flight.
  const [, startTransition] = useTransition();

  // loadQueue is only ever called imperatively now ("Check for more", "Another session?",
  // retry), which is exactly why it still needs a request token rather than an effect-cleanup
  // `cancelled` flag: there is no effect to clean up, and a user can tap twice. Each call takes
  // its own id and a response applies state only if it is still the most recent one in flight.
  const requestIdRef = useRef(0);

  // Refetch the queue. No longer called on mount (the server built the first one), but still
  // needed whenever a batch is exhausted, so cards that became due mid-session (one rated
  // "Again", or a learning-step card) cycle back without a manual reload.
  const loadQueue = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      const res = await fetch(`/api/cards/queue?level=${encodeURIComponent(level)}`);
      if (!res.ok) throw new Error(`queue ${res.status}`);
      const data: StudySessionPayload = await res.json();
      if (requestIdRef.current !== requestId) return;
      setCards(data.cards);
      setRemainingDue(data.totalDue);
      setIndex(0);
      setReviewed([]);
      setFlipped(false);
      setSessionDone(false);
      setError(null);
      setLoadFailed(false);
    } catch {
      if (requestIdRef.current !== requestId) return;
      setError("Couldn't load your study queue.");
      setLoadFailed(true);
      // `cards` is left alone on purpose: a failed refetch must not discard the session that
      // is already on screen, and the retry screen below is what the user sees meanwhile.
    }
  }, [level]);

  const current = index < cards.length ? cards[index] : null;

  const rate = useCallback(
    (rating: Rating) => {
      if (!current) return;
      // Snapshot both facts the rollback needs, before any state starts moving.
      const wordId = current.wordId;
      const wasLastCard = index >= cards.length - 1;

      // **Advance first, ask the server second.** Rating is the one action a user performs
      // twenty times in a row, and making each one wait on a round trip made a session feel
      // like it was buffering. All three pieces of state move now and are rolled back together
      // if the write fails.
      //
      // Advance uniformly, including on the last card, so `index` always equals the number of
      // cards rated and `reviewed` always holds every rated wordId. That invariant is what
      // lets one undo implementation serve both the header button and the completion screen.
      //
      // **Not `useOptimistic`.** It reconciles an optimistic value against server-derived
      // state and reverts when the transition settles. `index` is client-owned state that no
      // server response ever replaces, so there is nothing to reconcile against; the base
      // value would have to come from the server for that hook to mean anything.
      setReviewed((r) => [...r, wordId]);
      setIndex((i) => i + 1);
      setFlipped(false);
      if (wasLastCard) {
        // Last card → the session-complete screen. No auto-refetch, so there is a clear
        // stopping point (FSRS sessions should feel finite).
        setSessionDone(true);
      }
      setError(null);

      startTransition(async () => {
        try {
          await rateCard({ wordId, rating });
        } catch {
          // Put the card back exactly as it was: same index, same history, and revealed,
          // because it was revealed at the moment it was rated.
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

  // Undo keeps an in-flight guard even though rating no longer has one, and the asymmetry is
  // the point rather than an oversight. Two quick ratings hit two *different* cards, which is
  // what rapid-fire rating means and is now supported. Two quick undos hit the *same* card: the
  // second finds no log row left to roll back, so the action throws and the user is shown a
  // failure for something that did in fact work once. A ref, not state, so taking the guard
  // costs no render; the button's `disabled` stays tied to the history alone so it never
  // flickers mid-tap.
  const undoing = useRef(false);

  // Deliberately not optimistic, unlike `rate`. Undo is a corrective action taken once, not on
  // the hot path, so the round trip is affordable, and rolling back a rollback is materially
  // harder to reason about than rolling back an advance.
  const undo = useCallback(async () => {
    if (undoing.current || reviewed.length === 0) return;
    undoing.current = true;
    setError(null);
    const wordId = reviewed[reviewed.length - 1];
    try {
      await undoRating({ wordId });
      setReviewed((r) => r.slice(0, -1));
      setIndex((i) => Math.max(0, i - 1));
      setFlipped(false);
      // Undoing from the completion screen re-opens the session on the last card
      // (a no-op mid-session, where sessionDone is already false).
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
  // `<body>` after every card and a keyboard user re-Tabbed from the top of the document twenty
  // times a session. Targets follow the rule in `use-focus-on-transition.ts`.
  //
  // **The reveal deliberately moves nothing** (`flipped ? null : …`). Its next step is a *choice*
  // among four ratings, and focusing "Again" would let a reflexive second Space press bury a card
  // the user had not read, which is the hazard SPEC §14.18 declined Anki's Space-rates-Good binding to
  // avoid. Anchoring focus near the ratings instead was rejected for a second reason: the reveal
  // already fires the polite `role="status"` announcement below, and moving focus in the same
  // commit can cut a screen reader off mid-sentence. Rating keys work from anywhere, so nothing is
  // lost by staying put.
  const showAnswerRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const focusTarget = sessionDone || !current ? doneRef : flipped ? null : showAnswerRef;
  useFocusOnTransition(focusTarget, `${index}:${flipped}:${sessionDone}`);

  // --- keyboard shortcuts (SPEC §8.4) ---
  //
  // Bound only while a card is actually on screen. The loading, load-failure and
  // session-complete screens are ordinary two-or-three-button layouts reachable by Tab;
  // a global Space handler over them would be a surprise, not a shortcut.
  //
  // Space/Enter reveals and then deliberately goes inert: Anki maps Space to "Good" once
  // the answer is showing, and this app does not (SPEC §14.18). Rating is 1–4 only, so a
  // reflexive Space can never schedule a card the user had not finished reading.
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
  // There is no loading branch. The first queue arrives as a prop, and the wait that used to
  // live here is now `<Suspense>`'s fallback in `app/study/page.tsx` (`SessionLoading`).
  //
  // **Every branch below renders exactly one `<h1>`**, and this is the pattern all four
  // session components follow (SPEC §8.4). The branches are mutually exclusive renders of
  // the same route, so "one `<h1>` per page" means one per branch, not one per file.
  //
  //   - The load-failure and session-complete screens already had a display-type headline;
  //     it is now marked up as the heading it visually is. On the complete screen that is
  //     the same element that already carries `ref` + `tabIndex={-1}`, so the two mechanisms
  //     coincide rather than competing: focus lands on the heading, which is exactly what a
  //     screen reader wants read out on arrival.
  //   - The *active* card screen has no visible headline by design — the card is the
  //     content, and a title bar above it would be chrome competing with recall. It gets a
  //     visually-hidden `<h1>` instead, so heading navigation finds the screen without
  //     changing a pixel. Naming the level in it ("Flashcards · N3") means the heading also
  //     answers "which deck am I in?", which the level chip answers for sighted users.

  // Refetch failure: we no longer know what is due, so offer a retry rather than the
  // misleading "All caught up!" empty state. Only reachable from `loadQueue`: a failed
  // *first* build throws on the server and lands in `app/study/error.tsx` instead.
  if (loadFailed && !sessionDone) {
    return (
      <Centered>
        <Parrot expr="sleepy" title="Pī looking concerned" style={{ width: 124, height: 138 }} />
        <h1 className="mt-4 text-2xl" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
          Couldn&apos;t load
        </h1>
        <p className="mt-1" style={{ color: "var(--ink-soft)" }}>
          {error ?? "Something went wrong loading your study queue."}
        </p>
        <div className="mt-6 flex gap-3">
          <button onClick={() => void loadQueue()} className="btn btn-primary">
            Try again
          </button>
          <Link href="/home" className="btn btn-ghost">
            Home
          </Link>
        </div>
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
    const approxRemaining = Math.max(0, remainingDue - cards.length);
    return (
      <Centered>
        <Parrot
          expr={allCaughtUp ? "wow" : "happy"}
          title={allCaughtUp ? "Pī cheering" : "Pī smiling"}
          style={{ width: 124, height: 138 }}
        />
        {/* tabIndex={-1}: focusable by script, not by Tab. The standard way to land a screen
            reader on "where you now are" without adding a tab stop that does nothing. It is
            an <h1> as well as the focus target — see the render-states comment above. */}
        <h1
          ref={doneRef}
          tabIndex={-1}
          className="mt-4 text-2xl"
          style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}
        >
          {allCaughtUp ? "All caught up! 🎉" : "Session done! 🎉"}
        </h1>
        <p className="mt-1" style={{ color: "var(--ink-soft)" }}>
          {allCaughtUp ? (
            <>No cards are due right now. <span lang="ja" className="jp">またね！</span></>
          ) : approxRemaining > 0 ? (
            <>About {approxRemaining} more cards due today.</>
          ) : (
            <>All caught up! <span lang="ja" className="jp">おつかれさま</span></>
          )}
        </p>
        <div className="mt-6 flex gap-3">
          <button onClick={() => void loadQueue()} className="btn btn-primary">
            {allCaughtUp ? "Check for more" : "Another session?"}
          </button>
          <Link href="/home" className="btn btn-ghost">
            Home
          </Link>
        </div>
        {/* Escape hatch for a fat-fingered rating on the LAST card — before, undo
            was only reachable mid-session, so that one mistake was unrecoverable. */}
        {!allCaughtUp && reviewed.length > 0 && (
          <button onClick={() => void undo()} className="btn btn-ghost mt-3 text-sm">
            Undo last rating
          </button>
        )}
        {/* Same always-mounted `role="alert"` as the mid-session notice: the undo button above
            is live on this screen, so a failure here is just as silent without it. */}
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

  // What the reveal announces (see the live region below). Reading and meaning only: those two
  // *are* the answer, whereas the example sentence is supporting context the user can read off
  // the card whenever they want, and pushing a full Japanese sentence plus its kana through an
  // English speech synthesiser is noise rather than help.
  const revealedAnswer = `${current.reading}. ${current.meaning}`;

  return (
    // h-svh: same fix as quiz-session — pins to chrome-visible viewport so the footer
    // rating buttons are never hidden under the browser tab bar. See quiz-session.tsx.
    <main className="flex h-svh flex-col pt-safe">
      <h1 className="sr-only">Flashcards · {level}</h1>
      {/* Top bar: progress bar + count + undo */}
      <SessionHeader
        progress={progress}
        level={level}
        left={
          <>
            <SessionHeaderLink href="/home">Home</SessionHeaderLink>
            <span className="mx-2">·</span>
            {remaining} left
          </>
        }
        /* Undo advertises its shortcut via `title` rather than a .kbd-hint keycap: this
           pill is deliberately the quietest control on the screen (BRAND.md §7 session
           chrome), and a badge here would cost more than the hint is worth. */
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

      {/* Card: tap anywhere to reveal the answer (BRAND.md §7 flashcard).
          Section is overflow-y-auto so long revealed sentences scroll within the section
          rather than pushing the footer off-screen. my-auto centers the card when it fits;
          collapses to top when it overflows (avoids the Safari justify-center clip bug).

          The card is a plain <div>, not a <button>. Wrapping it was costing three things:
          Blink and WebKit apply `user-select: none` to button content, so a learner could
          not select the word or the example sentence to paste into a dictionary, which on
          a vocabulary app is a functional loss; a screen reader read the whole revealed card
          (expression, reading, meaning, sentence, its reading, the translation) as one
          enormous button name; and once flipped it was a focusable control that did
          nothing. Tap-anywhere survives as the overlay below. */}
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
          {/* Tap-anywhere-to-flip, as a transparent overlay that unmounts on reveal.
              Pointer-only on purpose: aria-hidden plus tabIndex={-1} keeps it out of the
              tab order and out of the accessibility tree, because the footer's "Show
              answer" button already exposes this exact action. A labelled overlay would
              put two identically-named buttons in the tree for one action; an unlabelled
              focusable one would be a bare stop on the Tab path. It needs no z-index and
              no particular DOM position: a positioned element paints above the card's
              in-flow content whatever the tree order, and being out of flow it also sits
              outside the flex layout, so it adds nothing to the `gap-5` rhythm. */}
          {!flipped && (
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              onClick={() => setFlipped(true)}
              className="absolute inset-0 cursor-pointer rounded-[var(--r-lg)]"
            />
          )}

          <div lang="ja" className="jp text-6xl" style={{ fontWeight: 700, color: "var(--ink)", lineHeight: 1.1 }}>
            {current.expression}
          </div>

          {flipped ? (
            <div className="flex w-full flex-col items-center gap-2">
              <div lang="ja" className="jp text-2xl" style={{ color: "var(--mag-600)", fontWeight: 700 }}>
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
                  <p lang="ja" className="jp text-[17px] leading-relaxed" style={{ color: "var(--ink)" }}>
                    {current.sentence.japanese}
                  </p>
                  <p lang="ja" className="jp mt-1 text-[13px]" style={{ color: "var(--ink-faint)" }}>
                    {current.sentence.reading}
                  </p>
                  <p className="mt-2 text-[14px] italic" style={{ color: "var(--ink-soft)" }}>
                    {current.sentence.english}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <span lang="ja" className="jp text-sm" style={{ color: "var(--ink-faint)" }}>
              タップして答え · tap to reveal
            </span>
          )}
        </div>
      </section>

      {/* Screen-reader announcement of the reveal. Flipping a card is a silent change: the
          headword stays put and the answer is simply appended below it, so nothing tells a
          screen-reader user that the tap did anything. Quiz and Exam already announce their
          result this way, and the same two constraints apply here. The node is part of the
          normal render rather than mounted on flip, because a live region created at the moment
          it first has something to say is frequently not announced at all (the original comment
          is in quiz-session.tsx). And the announcement is a duplicate of visible text, which is
          accepted: the tidier-looking alternative (`aria-live` on the answer container itself) is
          precisely the mounts-with-its-content case that goes unheard. */}
      <div role="status" className="sr-only">
        {flipped ? revealedAnswer : ""}
      </div>

      {/* Failure notice. `role="alert"` (assertive, atomic) rather than `role="status"`: this
          says a rating or an undo was *not* saved, and a polite region would queue behind
          whatever the reveal above is still reading out. The wrapper is always mounted for the
          same reason as that region, and carries no padding of its own so an empty one adds no
          height to the flex column. */}
      <div role="alert">
        {error && (
          <p className="px-4 pb-1 text-center text-sm" style={{ color: "var(--bad)" }}>
            {error}
          </p>
        )}
      </div>

      {/* Footer: rating buttons appear once flipped. shrink-0 + safe-area padding — same
          reasoning as quiz-session footer. */}
      <footer
        className="mx-auto w-full max-w-md shrink-0 px-3 pt-2"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
      >
        {flipped ? (
          <div className="grid grid-cols-4 gap-2">
            {RATINGS.map((r) => (
              <button key={r.value} onClick={() => rate(r.value)} className={`rate ${r.cls}`}>
                {r.label}
                {/* .rate has no flex gap of its own (unlike .btn), so the badge brings its
                    own spacing. It collapses with the badge when display:none applies. */}
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

// Full-screen centered container for loading / empty / done states (paper + ink).
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 text-center pt-safe pb-safe">
      {children}
    </main>
  );
}
