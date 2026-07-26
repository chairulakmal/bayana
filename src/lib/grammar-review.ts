// Grammar review services — DB-backed FSRS operations for the grammar study queue.
//
// Mirrors the structure of review.ts but operates on GrammarPoint / GrammarProgress
// instead of Word / ReviewState.
//
//   reviewGrammarPoint     – apply a rating, persist GrammarProgress, append a log row.
//   undoLastGrammarReview  – revert the most recent review via ts-fsrs rollback, drop the log.
//   getGrammarQueue        – due cards first, then a batch of new (unseen) points.
//   getGrammarStats        – counts for the inline stats panel on /grammar.
//
// **Undo arrived after v1 and brought `GrammarReviewLog` with it.** This module used to say
// undo was omitted because grammar cards are lighter-weight, which stopped being the argument
// once the reason was examined: a mis-tapped "Easy" on a grammar card is exactly as
// unrecoverable as the last-card vocab case that was already worth fixing, and the two queues
// disagreeing on one key is a worse cost than the table. What made it non-trivial is that
// `GrammarProgress` stores only the *latest* state, so there was nothing to roll back to; the
// log is what supplies it, via the same `rollback(card, log)` call vocab uses. See the schema
// for the two alternatives rejected (snapshot columns, or trusting a client-sent prior state).
//
// Mutations run inside SERIALIZABLE transactions for the reason given at length in review.ts:
// the FSRS math happens in JS between reading a row and writing it back, and since the grammar
// UI now advances optimistically without disabling its rating buttons, concurrent writes for one
// card are a supported interaction rather than an abuse case.

import { defaultDeps, type Deps } from "@/lib/deps";
import { getStudySettings } from "@/lib/profile";
import { schedulerFor, toCard, fromCard, fromLog, toLog } from "@/lib/fsrs";
import type { Grade } from "ts-fsrs";
import { shuffle } from "@/lib/word-similarity";
import { Prisma } from "@/generated/prisma/client";

// Grammar levels are plain strings (not the vocab `Level` enum) so new levels need no
// schema change — see SPEC.md §16 (2026-06-29, decision (c)). Shared here so both
// /api/grammar/queue and /api/grammar/browse validate against the same set.
export const GRAMMAR_LEVELS = new Set(["N5", "N4", "N3", "N2", "N1"]);

/** Apply a rating (1=Again, 2=Hard, 3=Good, 4=Easy) to a (user, grammarPoint).
 *  Persists the updated scheduling state and appends a review-log row that `undoLastGrammarReview`
 *  can roll back. */
export async function reviewGrammarPoint(
  userId: string,
  grammarPointId: string,
  rating: number,
  deps: Deps = defaultDeps,
) {
  const { serializableTxn } = deps;
  const now = new Date();

  // Per-user config, not per-card state — safe to read outside the transaction.
  const profile = await getStudySettings(userId, deps);

  // Read-compute-write as one atomic unit, same reasoning as reviewWord (review.ts):
  // concurrent ratings of the same card would otherwise lose one update.
  return serializableTxn(async (tx) => {
    const existing = await tx.grammarProgress.findUnique({
      where: { userId_grammarPointId: { userId, grammarPointId } },
    });

    const scheduler = schedulerFor(profile);
    // `log` is now captured as well as `card`. It was previously discarded, which is precisely
    // what made undo impossible: it is the record of what this rating changed, and therefore
    // the only thing that can describe the state to return to.
    const { card: next, log } = scheduler.next(toCard(existing, now), now, rating as Grade);
    const cardFields = fromCard(next);

    await tx.grammarProgress.upsert({
      where: { userId_grammarPointId: { userId, grammarPointId } },
      create: { userId, grammarPointId, ...cardFields },
      update: cardFields,
    });
    // Inside the same transaction as the upsert, so a rating can never be persisted without the
    // means to reverse it (which would present the user an Undo button that then fails).
    await tx.grammarReviewLog.create({ data: { userId, grammarPointId, ...fromLog(log) } });

    return { due: next.due, state: cardFields.state };
  });
}

/** Undo the most recent review for a (user, grammarPoint): roll the card back to its prior
 *  state and delete that log row. Returns null if there is nothing to undo.
 *
 *  Line-for-line the vocab `undoLastReview`, on the grammar tables. The duplication is
 *  deliberate at this size: the two differ only in the table and key names, but factoring them
 *  together would mean passing Prisma delegates around, which costs more in readability than
 *  the ~20 shared lines are worth. If a third queue ever appears, revisit. */
export async function undoLastGrammarReview(
  userId: string,
  grammarPointId: string,
  deps: Deps = defaultDeps,
) {
  const { serializableTxn } = deps;
  const profile = await getStudySettings(userId, deps);

  try {
    return await serializableTxn(async (tx) => {
      // Sequential (not Promise.all): an interactive transaction holds one connection.
      const current = await tx.grammarProgress.findUnique({
        where: { userId_grammarPointId: { userId, grammarPointId } },
      });
      const lastLog = await tx.grammarReviewLog.findFirst({
        where: { userId, grammarPointId },
        orderBy: { reviewedAt: "desc" },
      });
      // Either missing means there is nothing to reverse. Note this is also the state of every
      // grammar card rated *before* this table existed: those reviews have no log row and are
      // therefore not undoable, which is correct and needs no backfill: undo only ever reaches
      // one rating back, within the session that made it.
      if (!current || !lastLog) return null;

      // rollback(currentCard, log) reconstructs the card as it was before that review.
      const previous = schedulerFor(profile).rollback(toCard(current), toLog(lastLog));

      await tx.grammarProgress.update({
        where: { userId_grammarPointId: { userId, grammarPointId } },
        data: fromCard(previous),
      });
      await tx.grammarReviewLog.delete({ where: { id: lastLog.id } });

      return { due: previous.due };
    });
  } catch (err) {
    // Defense in depth, same as review.ts: a concurrent undo of the same review that slips past
    // the serialization retries surfaces as P2025 ("record not found") when the second
    // transaction deletes the already-deleted log row. Semantically that is just "nothing left
    // to undo", so map it to null, not a 500.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return null;
    }
    throw err;
  }
}

/**
 * Build the grammar study queue for a session.
 *
 * Same two-pool strategy as vocab:
 *   1. Due cards — GrammarProgress rows whose `due` has passed, ordered oldest-first.
 *   2. New points — GrammarPoint rows with no GrammarProgress yet, randomly sampled up
 *      to `newCardsPerDay` (from the user's profile).
 *
 * `level` filters new points to the user's active level; due cards are always included
 * regardless of level so nothing in-progress gets stranded.
 */
export async function getGrammarQueue(
  userId: string,
  opts: { level?: string; sessionLimit?: number } = {},
  deps: Deps = defaultDeps,
) {
  const { db } = deps;
  const sessionLimit = opts.sessionLimit ?? 20;
  const now = new Date();
  const profile = await getStudySettings(userId, deps);

  const [totalDue, due] = await Promise.all([
    db.grammarProgress.count({ where: { userId, due: { lte: now } } }),
    db.grammarProgress.findMany({
      where: { userId, due: { lte: now } },
      orderBy: { due: "asc" },
      take: sessionLimit,
      include: { grammarPoint: true },
    }),
  ]);

  const newSlots = Math.min(
    Math.max(0, sessionLimit - due.length),
    profile.newCardsPerDay,
  );

  // Candidate new points: no GrammarProgress row for this user yet, filtered by level.
  const candidates = await db.grammarPoint.findMany({
    where: {
      ...(opts.level ? { level: opts.level } : {}),
      progress: { none: { userId } },
    },
    select: { id: true },
    orderBy: [{ lesson: "asc" }, { position: "asc" }],
  });

  // Shuffle to vary across sessions, then slice to newSlots.
  const pickedIds = shuffle(candidates.map((c) => c.id)).slice(0, newSlots);

  const unordered = await db.grammarPoint.findMany({
    where: { id: { in: pickedIds } },
  });
  const byId = new Map(unordered.map((g) => [g.id, g]));
  const newPoints = pickedIds.map((id) => byId.get(id)).filter((g) => g !== undefined);

  return { due, newPoints, totalDue };
}

/**
 * Stats for the inline panel on /grammar:
 *   total        — all GrammarPoints at this level
 *   started      — points with at least one GrammarProgress row
 *   mature       — points with scheduledDays ≥ 21 (stable long-term memory)
 *   dueNow       — GrammarProgress rows whose due date has passed
 *   studiedToday — true if any grammar point at this level was reviewed today
 *                  (derived from lastReview; no review-event log needed)
 *   studiedTodayCount — how many distinct points were reviewed today. Same query as
 *                  `studiedToday`, exposed as a number so the home hub can display it
 *                  without re-running the count (`getHomeSnapshot`). Note the unit: this
 *                  counts *points touched*, not review events, because GrammarProgress
 *                  holds only the latest review per point (there is no grammar ReviewLog).
 */
export async function getGrammarStats(
  userId: string,
  level: string,
  { db }: Deps = defaultDeps,
) {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const [total, started, mature, dueNow, studiedTodayCount] = await Promise.all([
    db.grammarPoint.count({ where: { level } }),
    db.grammarProgress.count({ where: { userId, grammarPoint: { level } } }),
    db.grammarProgress.count({
      where: { userId, grammarPoint: { level }, scheduledDays: { gte: 21 } },
    }),
    db.grammarProgress.count({
      where: { userId, grammarPoint: { level }, due: { lte: now } },
    }),
    db.grammarProgress.count({
      where: { userId, grammarPoint: { level }, lastReview: { gte: startOfToday } },
    }),
  ]);

  return { total, started, mature, dueNow, studiedTodayCount, studiedToday: studiedTodayCount > 0 };
}

/**
 * Which JLPT levels actually have grammar points seeded.
 *
 * Derived from the table rather than hardcoded to "N3", even though N3 is the only seeded
 * deck today (SPEC §4.1). The restriction is a property of what has been imported, not of
 * the design, so a literal would become wrong the moment a second deck lands and would be
 * wrong *silently* — the level picker would keep telling users a seeded level is empty.
 *
 * One `groupBy` over ~220 rows, so it is cheap enough to call on a page render.
 *
 * @returns the set of level strings ("N3", …) with at least one GrammarPoint
 */
export async function getSeededGrammarLevels(
  { db }: Deps = defaultDeps,
): Promise<Set<string>> {
  const rows = await db.grammarPoint.groupBy({ by: ["level"] });
  return new Set(rows.map((row) => row.level));
}

