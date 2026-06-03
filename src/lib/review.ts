// Review services — DB-backed FSRS operations for Anki mode.
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
 *   1. due cards — anything already in learning/review whose `due` has passed;
 *   2. new words — words this user has never reviewed, capped at `newCardsPerDay`.
 *  `level` scopes the new words (Phase 1a studies N3); due cards are returned regardless
 *  of level so nothing already in progress gets stranded. */
export async function getStudyQueue(
  userId: string,
  opts: { level?: Level; now?: Date } = {},
) {
  const now = opts.now ?? new Date();
  const profile = await db.userProfile.findUniqueOrThrow({ where: { userId } });

  const due = await db.reviewState.findMany({
    where: { userId, due: { lte: now } },
    orderBy: { due: "asc" },
    include: { word: { include: { sentences: { take: 1 } } } },
  });

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
  const pickedIds = shuffle(candidates.map((c) => c.id)).slice(0, profile.newCardsPerDay);

  // Fetch the chosen words, then restore the shuffled order (a `WHERE id IN (...)` query
  // does not preserve the order of the id list).
  const unordered = await db.word.findMany({
    where: { id: { in: pickedIds } },
    include: { sentences: { take: 1 } },
  });
  const byId = new Map(unordered.map((w) => [w.id, w]));
  const newWords = pickedIds.map((id) => byId.get(id)).filter((w) => w !== undefined);

  return { due, newWords };
}

/** In-place Fisher–Yates shuffle. Returns the same array for chaining. */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
