// Home-hub snapshot: the read-only aggregate behind `/home` (SPEC §8.5).
//
// Why this exists rather than reusing `getLevelStats` (src/lib/stats.ts): the hub needs a
// handful of "what should I tap right now" counts on the app's *default landing page*, so
// it must stay cheap. `getLevelStats` additionally pulls every word id in the level (~2,100
// rows for N3) and scans 30 days of ReviewLog to compute a recall rate, real work that the
// hub never renders. That belongs on `/stats`, which exists to be a heavier page.
//
// The guiding rule here is **honesty over tidiness**: every number the hub shows must match
// what tapping the corresponding tile actually gives you. See `vocabDue` below for the case
// where that forced an asymmetry.

import { db } from "@/lib/db";
import type { Level } from "@/generated/prisma/enums";
import { getGrammarStats } from "@/lib/grammar-review";

/** What `/home` renders. Field-level scoping notes are on `getHomeSnapshot`. */
export type HomeSnapshot = {
  /** Vocab cards due now, across ALL levels. See the scoping note in `getHomeSnapshot`. */
  vocabDue: number;
  /** Words in the active level that have been seen at least once. */
  vocabStarted: number;
  /** Total words in the active level. */
  vocabTotal: number;
  /** Grammar points due now in the active level. */
  grammarDue: number;
  /** Grammar points in the active level that have been started. */
  grammarStarted: number;
  /** Total grammar points seeded for the active level (0 if the level has none yet). */
  grammarTotal: number;
  /**
   * Distinct cards studied since the start of today, vocab + grammar: the "you showed up"
   * signal. **Cards, not review events**, and the distinction is load-bearing. A vocab card
   * rated Again cycles through learning steps and writes several ReviewLog rows, whereas
   * grammar has no event log at all (GrammarProgress holds only the latest review per
   * point), so it can only ever report one. Summing raw counts would add events to cards and
   * make a bad vocab session look like a productive day. De-duplicating vocab by word makes
   * both halves mean the same thing.
   */
  cardsStudiedToday: number;
};

/**
 * Start of the current day, used for the "done today" counts.
 *
 * Caveat, stated rather than hidden: this is the *server's* local midnight, not the user's.
 * Bayana has no per-user timezone or day-start preference yet, so every day-boundary
 * calculation in the codebase shares this limitation (`getGrammarStats` does the same).
 * Centralising it here means the eventual fix is one function, not a grep. Tracked in
 * TODO.md's review backlog.
 */
function startOfToday(now: Date): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * Collects every count the home hub displays, in one parallel round-trip.
 *
 * `level` is the user's active level (`UserProfile.activeLevel`) and scopes most fields,
 * with one deliberate exception:
 *
 * **`vocabDue` is NOT level-scoped.** `getStudyQueue` returns due cards regardless of level
 * "so nothing already in progress gets stranded" (src/lib/review.ts), and it would be a lie
 * for the Flashcards tile to promise "3 due" when tapping it serves 19. The tile must
 * describe the session the user is about to get. Level-scoped progress (`vocabStarted` and
 * `vocabTotal`) stays level-scoped, because that bar is explicitly labelled with the level.
 *
 * @param userId - the acting user (already authenticated by the caller)
 * @param level  - the user's active JLPT level
 * @param now    - injectable clock, so this is testable without freezing time globally
 * @returns every count `/home` renders; grammar totals are 0 for un-seeded levels
 */
export async function getHomeSnapshot(
  userId: string,
  level: Level,
  now: Date = new Date(),
): Promise<HomeSnapshot> {
  const dayStart = startOfToday(now);

  // All independent reads, so run them concurrently. Each is a COUNT with no joins beyond
  // the level filter, which keeps this well under the latency budget for a landing page.
  const [vocabDue, vocabStarted, vocabTotal, vocabStudiedToday, grammar] = await Promise.all([
    // Level-agnostic on purpose, mirroring getStudyQueue. See the doc comment above.
    db.reviewState.count({ where: { userId, due: { lte: now } } }),
    db.reviewState.count({ where: { userId, word: { level } } }),
    db.word.count({ where: { level } }),
    // `distinct` rather than `count`, so this yields cards studied rather than ratings
    // submitted (see `cardsStudiedToday`). Bounded to one day of logs, so the row set is
    // small; there is no `count(distinct)` in the Prisma query API.
    db.reviewLog.findMany({
      where: { userId, reviewedAt: { gte: dayStart } },
      select: { wordId: true },
      distinct: ["wordId"],
    }),
    // Reuse rather than re-derive: the grammar hub already has exactly this aggregate,
    // and duplicating it here is how the two pages would eventually disagree. It also
    // already counts points studied today, so the hub does not repeat that query.
    // `GrammarPoint.level` is a plain String column (level-agnostic schema, SPEC §4.1),
    // hence the toString(). It is not the Level enum.
    getGrammarStats(userId, level.toString()),
  ]);

  return {
    vocabDue,
    vocabStarted,
    vocabTotal,
    grammarDue: grammar.dueNow,
    grammarStarted: grammar.started,
    grammarTotal: grammar.total,
    cardsStudiedToday: vocabStudiedToday.length + grammar.studiedTodayCount,
  };
}

/** The study mode the hub's single primary CTA should point at. */
export type NextAction = {
  href: string;
  /** Button label. Always an invitation, never a scold (BRAND.md §1). */
  label: string;
  /** One line explaining what the tap will actually give you. */
  detail: string;
};

/**
 * Picks the one thing the primary CTA should do, so the hub honours the "start with one
 * tap, no config" promise (SPEC §2, §8.5) instead of making the user triage four tiles.
 *
 * Priority order, and why:
 *   1. **Due vocab.** Overdue spaced-repetition reviews are the only genuinely
 *      time-sensitive work in the app. Every day they slip, retention drops and the
 *      backlog compounds (the #1 reason people quit SRS, SPEC §16 2026-06-04).
 *   2. **Due grammar.** Same argument, second because the grammar deck is one level
 *      deep (N3 only) and smaller, so it is rarely the bigger debt.
 *   3. **New vocab.** Nothing is due, so spend the session growing the deck.
 *   4. **Quiz.** Fully caught up and the level is exhausted, so offer the non-scheduling
 *      practice mode rather than a dead end. The hub never says "all done, go away".
 */
export function pickNextAction(snapshot: HomeSnapshot): NextAction {
  if (snapshot.vocabDue > 0) {
    return {
      href: "/study",
      label: "Start reviewing",
      detail: `${snapshot.vocabDue} card${snapshot.vocabDue === 1 ? "" : "s"} ready`,
    };
  }
  if (snapshot.grammarDue > 0) {
    return {
      href: "/grammar/study",
      label: "Study grammar",
      detail: `${snapshot.grammarDue} point${snapshot.grammarDue === 1 ? "" : "s"} ready`,
    };
  }
  if (snapshot.vocabStarted < snapshot.vocabTotal) {
    return {
      href: "/study",
      label: "Learn new words",
      detail: "Nothing due, so start fresh cards",
    };
  }
  return { href: "/quiz", label: "Take a quiz", detail: "All caught up, keep it sharp" };
}
