// The shape a Grammar session renders, and the one place it is built.
//
// This is the grammar counterpart of `study-cards.ts`, and it exists for the same reason.
// `getGrammarQueue` (lib/grammar-review.ts) returns Prisma rows, so every due card arrived
// carrying its full `GrammarProgress` FSRS internals (`stability`, `difficulty`, `reps`,
// `lapses`, `elapsedDays`, `scheduledDays`, `learningSteps`, `state`, `lastReview`, `due`)
// wrapped around a whole `GrammarPoint` row, of which the session reads six fields and ignores
// `level`, `lesson`, `lessonTitle` and `position`. The scheduling state is the server's
// business, and shipping it to a browser that cannot act on it is payload with no consumer.
//
// It lives here rather than in either caller because there are two: the `/grammar/study` page
// renders the first session server-side, and `GET /api/grammar/queue` still serves the
// imperative refetch ("Check for more", "Another session?", the retry). One definition means
// the two cannot disagree about the shape.
//
// **Note the shape differs from `StudySessionPayload` by one field, and the difference is
// real rather than an oversight.** Vocab estimates its "N more waiting" hint as
// `totalDue - cards.length`, which over-counts whenever new words padded the batch, and its
// comment calls the result approximate. Grammar can do better because it already tracked the
// due/new split separately, so `dueCount` is carried through and the hint is exact. The two
// payload types are deliberately not unified: they describe different entities, and collapsing
// them would mean either losing this precision or adding a field vocab cannot populate.

import { getGrammarQueue } from "@/lib/grammar-review";
import { defaultDeps, type Deps } from "@/lib/deps";

/** One grammar card exactly as the session renders it. No scheduling internals by design. */
export type GrammarCard = {
  grammarPointId: string;
  /** Display form shown on the front of the card, e.g. "ばいい". */
  pattern: string;
  /** Kana reading. May equal `pattern` for a kana-only point, which the session checks. */
  reading: string;
  meanings: string[];
  exampleJp: string;
  exampleEn: string;
};

/** One session's worth of grammar cards, plus the two counts the completion screen needs. */
export type GrammarSessionPayload = {
  cards: GrammarCard[];
  /** Total due at queue-build time, **before** the session cap was applied. */
  totalDue: number;
  /** How many of `cards` were due reviews rather than new points; see the header note. */
  dueCount: number;
};

/**
 * The minimum a grammar point must structurally satisfy to be flattened. Declared here rather
 * than imported from the generated client so this module does not care whether it is handed a
 * `GrammarPoint` row or anything else with the same six fields.
 */
type PointFields = {
  id: string;
  pattern: string;
  reading: string;
  meanings: string[];
  exampleJp: string;
  exampleEn: string;
};

/** Flatten one grammar point into a card. */
function toGrammarCard(point: PointFields): GrammarCard {
  return {
    grammarPointId: point.id,
    pattern: point.pattern,
    reading: point.reading,
    meanings: point.meanings,
    exampleJp: point.exampleJp,
    exampleEn: point.exampleEn,
  };
}

/**
 * Build one session's grammar cards for a user: due cards first, then new points filling the
 * remaining slots. The ordering is the point of the concatenation rather than an accident: reviews are the commitment a session is for, and new points are what is added once the
 * commitment is met, matching vocab (§8.1).
 *
 * @param userId whose queue to build; every query inside is scoped to it.
 * @param opts `level` scopes the new points only (due cards come back regardless of level so
 *   nothing already in progress is stranded); `sessionLimit` caps the total, default 20.
 *   `level` is a plain string, not the `Level` enum, because `GrammarPoint.level` is a string
 *   column so new decks need no migration (see the schema).
 * @returns the flattened cards plus the pre-cap `totalDue` and this batch's `dueCount`.
 */
export async function buildGrammarSession(
  userId: string,
  opts: { level?: string; sessionLimit?: number } = {},
  deps: Deps = defaultDeps,
): Promise<GrammarSessionPayload> {
  const { due, newPoints, totalDue } = await getGrammarQueue(userId, opts, deps);
  return {
    cards: [...due.map((d) => toGrammarCard(d.grammarPoint)), ...newPoints.map(toGrammarCard)],
    totalDue,
    dueCount: due.length,
  };
}
