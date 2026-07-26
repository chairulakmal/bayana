// Grammar review services — DB-backed FSRS operations for the grammar study queue.
//
// Mirrors the structure of review.ts but operates on GrammarPoint / GrammarProgress
// instead of Word / ReviewState. No undo in v1 (grammar cards are lighter-weight
// and undo adds complexity without much payoff at this stage).
//
//   reviewGrammarPoint  – apply a rating, persist the updated GrammarProgress row.
//   getGrammarQueue     – due cards first, then a batch of new (unseen) points.
//   getGrammarStats     – counts for the inline stats panel on /grammar.

import { db, serializableTxn } from "@/lib/db";
import { getStudySettings } from "@/lib/profile";
import { schedulerFor, toCard, fromCard } from "@/lib/fsrs";
import type { Grade } from "ts-fsrs";

// Grammar levels are plain strings (not the vocab `Level` enum) so new levels need no
// schema change — see SPEC.md §16 (2026-06-29, decision (c)). Shared here so both
// /api/grammar/queue and /api/grammar/browse validate against the same set.
export const GRAMMAR_LEVELS = new Set(["N5", "N4", "N3", "N2", "N1"]);

/** Apply a rating (1=Again, 2=Hard, 3=Good, 4=Easy) to a (user, grammarPoint). */
export async function reviewGrammarPoint(
  userId: string,
  grammarPointId: string,
  rating: number,
) {
  const now = new Date();

  // Per-user config, not per-card state — safe to read outside the transaction.
  const profile = await getStudySettings(userId);

  // Read-compute-write as one atomic unit, same reasoning as reviewWord (review.ts):
  // concurrent ratings of the same card would otherwise lose one update.
  return serializableTxn(async (tx) => {
    const existing = await tx.grammarProgress.findUnique({
      where: { userId_grammarPointId: { userId, grammarPointId } },
    });

    const scheduler = schedulerFor(profile);
    const { card: next } = scheduler.next(toCard(existing, now), now, rating as Grade);
    const cardFields = fromCard(next);

    await tx.grammarProgress.upsert({
      where: { userId_grammarPointId: { userId, grammarPointId } },
      create: { userId, grammarPointId, ...cardFields },
      update: cardFields,
    });

    return { due: next.due, state: cardFields.state };
  });
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
) {
  const sessionLimit = opts.sessionLimit ?? 20;
  const now = new Date();
  const profile = await getStudySettings(userId);

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
export async function getGrammarStats(userId: string, level: string) {
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
export async function getSeededGrammarLevels(): Promise<Set<string>> {
  const rows = await db.grammarPoint.groupBy({ by: ["level"] });
  return new Set(rows.map((row) => row.level));
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
