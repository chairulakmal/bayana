// Review services — DB-backed FSRS operations for Flashcard mode.
//
//   reviewWord     – apply a rating, persist the new ReviewState, append a ReviewLog.
//   undoLastReview – revert the most recent review via ts-fsrs rollback, drop the log.
//   getStudyQueue  – build today's queue: due cards + a capped number of new words.
//
// Mutations run inside SERIALIZABLE transactions (see serializableTxn in db.ts):
// the FSRS math happens in JS between reading a card's state and writing it back, so
// two concurrent requests for the same card (e.g. a double-tapped rating button)
// would otherwise both compute from the same stale row and one update would be lost.

import { db, serializableTxn } from "@/lib/db";
import { getStudySettings } from "@/lib/profile";
import { schedulerFor, toCard, fromCard, fromLog, toLog } from "@/lib/fsrs";
import type { Grade } from "ts-fsrs";
import { Prisma, type Level } from "@/generated/prisma/client";

/** Apply a rating (1=Again, 2=Hard, 3=Good, 4=Easy) to a (user, word).
 *  Persists the updated scheduling state and appends an immutable review-log row. */
export async function reviewWord(userId: string, wordId: string, rating: number) {
  const now = new Date();

  // The profile holds the user's FSRS tuning — per-user config, not per-card state,
  // so it's safe to read outside the transaction (it isn't part of the race).
  const profile = await getStudySettings(userId);

  // Read the card's current state, compute the next state, and write it back as one
  // atomic unit. `existing` is null the very first time this word is seen.
  return serializableTxn(async (tx) => {
    const existing = await tx.reviewState.findUnique({
      where: { userId_wordId: { userId, wordId } },
    });

    const scheduler = schedulerFor(profile);
    const { card: next, log } = scheduler.next(toCard(existing, now), now, rating as Grade);
    const cardFields = fromCard(next);

    await tx.reviewState.upsert({
      where: { userId_wordId: { userId, wordId } },
      create: { userId, wordId, ...cardFields },
      update: cardFields,
    });
    await tx.reviewLog.create({ data: { userId, wordId, ...fromLog(log) } });

    return { due: next.due, state: cardFields.state };
  });
}

/** Undo the most recent review for a (user, word): roll the card back to its prior
 *  state and delete that log row. Returns null if there is nothing to undo. */
export async function undoLastReview(userId: string, wordId: string) {
  const profile = await getStudySettings(userId);

  try {
    return await serializableTxn(async (tx) => {
      // Sequential (not Promise.all): an interactive transaction holds one connection.
      const current = await tx.reviewState.findUnique({
        where: { userId_wordId: { userId, wordId } },
      });
      const lastLog = await tx.reviewLog.findFirst({
        where: { userId, wordId },
        orderBy: { reviewedAt: "desc" },
      });
      if (!current || !lastLog) return null;

      // rollback(currentCard, log) reconstructs the card as it was before that review.
      const previous = schedulerFor(profile).rollback(toCard(current), toLog(lastLog));

      await tx.reviewState.update({
        where: { userId_wordId: { userId, wordId } },
        data: fromCard(previous),
      });
      await tx.reviewLog.delete({ where: { id: lastLog.id } });

      return { due: previous.due };
    });
  } catch (err) {
    // Defense in depth: a concurrent undo of the same review that slips past the
    // serialization retries surfaces as P2025 ("record not found") when the second
    // transaction deletes the already-deleted log row. Semantically that is just
    // "nothing left to undo" — map it to null (the route returns 404), not a 500.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return null;
    }
    throw err;
  }
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
  const profile = await getStudySettings(userId);

  // Two narrow queries instead of one fat one. We need both the slice we'll show AND the
  // total-waiting count, but materializing every due row (with its word + sentence joined)
  // just to slice 20 and call `.length` is O(backlog): a user who lapses for weeks could
  // pull hundreds of joined rows into memory on every queue build (the route is
  // force-dynamic, so nothing caches it). Instead:
  //   - count() — touches no joins, just the [userId, due] index;
  //   - findMany(take: sessionLimit) — bounds the expensive join to the cards we render.
  // Both run in parallel and both hit @@index([userId, due]).
  const [totalDue, due] = await Promise.all([
    db.reviewState.count({ where: { userId, due: { lte: now } } }),
    db.reviewState.findMany({
      where: { userId, due: { lte: now } },
      orderBy: { due: "asc" },
      take: sessionLimit,
      include: { word: { include: { sentences: { take: 1 } } } },
    }),
  ]);

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
