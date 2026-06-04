// Stats services — read-only aggregates for the /stats page (SPEC §13 "basic stats").
//
// Deliberately LIGHT: the full dashboard is deferred to Phase 4 (SPEC §16), so this is a
// few per-active-level numbers, not a sprawling analytics view. No writes and no FSRS
// mutation — just counts plus one small log scan. The day streak is intentionally left out
// for now (it needs timezone + day-rollover math) and will be a focused follow-up.

import { db } from "@/lib/db";
import { FsrsState, type Level } from "@/generated/prisma/enums";

/** Window (in days) the recall rate is measured over. Recent enough to reflect current form. */
const RECALL_WINDOW_DAYS = 30;

export type LevelStats = {
  level: Level;
  total: number; // words in the level
  started: number; // words seen at least once (i.e. have a ReviewState row)
  mature: number; // started words now in REVIEW state (graduated past learning)
  dueNow: number; // started words whose next review has come due
  /** Fraction in [0,1] of recent reviews recalled (rated better than "Again"); null if none yet. */
  recallRate: number | null;
  recallSample: number; // number of reviews the rate is based on (so the UI can show trust)
  recallWindowDays: number;
};

/**
 * Compute the light stats for one JLPT level.
 *
 * `due` / `started` / `mature` scope to the level cleanly through ReviewState's `word`
 * relation. Recall rate can't — ReviewLog has no `word` relation — so we fetch the level's
 * word ids once and filter the user's *recent* logs in memory. That's cheap: "recent" is
 * bounded to the last RECALL_WINDOW_DAYS, a small set, and avoids both a schema change and
 * a huge `WHERE wordId IN (...)` clause.
 */
export async function getLevelStats(
  userId: string,
  level: Level,
  now: Date = new Date(),
): Promise<LevelStats> {
  const since = new Date(now.getTime() - RECALL_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // One round-trip: the level's word ids (also gives us `total`), the three ReviewState
  // counts, and the recent log slice. Independent queries → run them in parallel.
  const [levelWords, started, mature, dueNow, recentLogs] = await Promise.all([
    db.word.findMany({ where: { level }, select: { id: true } }),
    db.reviewState.count({ where: { userId, word: { level } } }),
    db.reviewState.count({ where: { userId, word: { level }, state: FsrsState.REVIEW } }),
    db.reviewState.count({ where: { userId, word: { level }, due: { lte: now } } }),
    db.reviewLog.findMany({
      where: { userId, reviewedAt: { gte: since } },
      select: { wordId: true, rating: true },
    }),
  ]);

  // Scope recall to this level by keeping only logs for words in the level.
  const levelWordIds = new Set(levelWords.map((w) => w.id));
  const levelLogs = recentLogs.filter((l) => levelWordIds.has(l.wordId));
  // "Recalled" = rated anything but Again 1 or Hard 2: Hard/Good/Easy all mean you produced the
  // answer. This is a coarse recall proxy, not FSRS's retrievability — good enough for a
  // motivating headline number.
  const recalled = levelLogs.filter((l) => l.rating >= 3).length;
  const recallRate = levelLogs.length > 0 ? recalled / levelLogs.length : null;

  return {
    level,
    total: levelWords.length,
    started,
    mature,
    dueNow,
    recallRate,
    recallSample: levelLogs.length,
    recallWindowDays: RECALL_WINDOW_DAYS,
  };
}
