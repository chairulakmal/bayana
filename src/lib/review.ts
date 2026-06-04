// Review services — DB-backed FSRS operations for Flashcard mode.
//
//   reviewWord     – apply a rating, persist the new ReviewState, append a ReviewLog.
//   undoLastReview – revert the most recent review via ts-fsrs rollback, drop the log.
//   getStudyQueue  – build today's queue: due cards + a capped number of new words.
//
// All mutations that touch two tables (state + log) run in a transaction so they can
// never half-apply.

import { db } from "@/lib/db";
import { schedulerFor, toCard, fromCard, fromLog, toLog } from "@/lib/fsrs";
import type { Grade } from "ts-fsrs";
import type { Level } from "@/generated/prisma/client";

/** Apply a rating (1=Again, 2=Hard, 3=Good, 4=Easy) to a (user, word).
 *  Persists the updated scheduling state and appends an immutable review-log row. */
export async function reviewWord(userId: string, wordId: string, rating: number) {
  const now = new Date();

  // The profile holds the user's FSRS tuning; `existing` is the card's current state
  // (null the very first time this word is seen).
  const [profile, existing] = await Promise.all([
    db.userProfile.findUniqueOrThrow({ where: { userId } }),
    db.reviewState.findUnique({ where: { userId_wordId: { userId, wordId } } }),
  ]);

  const scheduler = schedulerFor(profile);
  const { card: next, log } = scheduler.next(toCard(existing, now), now, rating as Grade);

  const cardFields = fromCard(next);
  await db.$transaction([
    db.reviewState.upsert({
      where: { userId_wordId: { userId, wordId } },
      create: { userId, wordId, ...cardFields },
      update: cardFields,
    }),
    db.reviewLog.create({ data: { userId, wordId, ...fromLog(log) } }),
  ]);

  return { due: next.due, state: cardFields.state };
}

/** Undo the most recent review for a (user, word): roll the card back to its prior
 *  state and delete that log row. Returns null if there is nothing to undo. */
export async function undoLastReview(userId: string, wordId: string) {
  const [profile, current, lastLog] = await Promise.all([
    db.userProfile.findUniqueOrThrow({ where: { userId } }),
    db.reviewState.findUnique({ where: { userId_wordId: { userId, wordId } } }),
    db.reviewLog.findFirst({
      where: { userId, wordId },
      orderBy: { reviewedAt: "desc" },
    }),
  ]);
  if (!current || !lastLog) return null;

  // rollback(currentCard, log) reconstructs the card as it was before that review.
  const previous = schedulerFor(profile).rollback(toCard(current), toLog(lastLog));

  await db.$transaction([
    db.reviewState.update({
      where: { userId_wordId: { userId, wordId } },
      data: fromCard(previous),
    }),
    db.reviewLog.delete({ where: { id: lastLog.id } }),
  ]);

  return { due: previous.due };
}

/** Build the study queue:
 *   1. due cards — anything already in learning/review whose `due` has passed, prioritised
 *      first and capped to `sessionLimit`;
 *   2. new words — never-seen words that fill the remaining session slots, further capped
 *      by `profile.newCardsPerDay`. NOTE: this cap applies *per queue build*, not as a
 *      rolling per-calendar-day ceiling — a user who finishes a session can build another
 *      and get up to `newCardsPerDay` more new words. That is intentional (let motivated
 *      users push at their own pace; reviews-first scheduling self-corrects any overreach).
 *      See SPEC §16 (2026-06-04).
 *  `level` scopes the new words; due cards are returned regardless of level so nothing
 *  already in progress gets stranded.
 *  Returns `totalDue` (pre-cap count) so callers can tell the user how many are waiting. */
export async function getStudyQueue(
  userId: string,
  opts: { level?: Level; now?: Date; sessionLimit?: number } = {},
) {
  // sessionLimit caps the total cards shown in one sitting (due first, then new).
  // Default 20 matches the Anki community norm for a focused daily session.
  const sessionLimit = opts.sessionLimit ?? 20;
  const now = opts.now ?? new Date();
  const profile = await db.userProfile.findUniqueOrThrow({ where: { userId } });

  const allDue = await db.reviewState.findMany({
    where: { userId, due: { lte: now } },
    orderBy: { due: "asc" },
    include: { word: { include: { sentences: { take: 1 } } } },
  });

  // totalDue is the raw count before capping — returned to the client so it can show
  // "N more waiting" on the session-complete screen.
  const totalDue = allDue.length;
  const due = allDue.slice(0, sessionLimit);

  // How many slots remain for new words, honouring both the session cap and the
  // new-card pace preference (whichever is smaller wins). This is a *per-build* pace, not
  // a hard daily ceiling — see the function doc and SPEC §16.
  const newSlots = Math.min(
    Math.max(0, sessionLimit - due.length),
    profile.newCardsPerDay,
  );

  // New words: pick a RANDOM sample of never-seen words. The source deck is sorted by
  // reading, so taking them in insertion order clusters similar-sounding words together;
  // shuffling spreads them out and varies the cards across sessions.
  const candidates = await db.word.findMany({
    where: {
      ...(opts.level ? { level: opts.level } : {}),
      reviews: { none: { userId } }, // no ReviewState for this user ⇒ never seen
    },
    select: { id: true }, // ids only — cheap to fetch the whole candidate pool and shuffle
  });
  const pickedIds = shuffle(candidates.map((c) => c.id)).slice(0, newSlots);

  // Fetch the chosen words, then restore the shuffled order (a `WHERE id IN (...)` query
  // does not preserve the order of the id list).
  const unordered = await db.word.findMany({
    where: { id: { in: pickedIds } },
    include: { sentences: { take: 1 } },
  });
  const byId = new Map(unordered.map((w) => [w.id, w]));
  const newWords = pickedIds.map((id) => byId.get(id)).filter((w) => w !== undefined);

  return { due, newWords, totalDue };
}

/** In-place Fisher–Yates shuffle. Returns the same array for chaining. */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
