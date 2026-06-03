// FSRS adapter — the pure translation layer between our Prisma rows and ts-fsrs.
//
// Why this exists: ts-fsrs speaks its own shapes (`Card`/`ReviewLog`, snake_case,
// numeric `State`/`Rating` enums, `Date` objects). Confining all that translation
// to one file means the rest of the app deals only with our Prisma models, and any
// FSRS quirk lives in exactly one place. No database access here — this module is
// pure functions, which keeps it trivially unit-testable.
//
// FSRS in one paragraph: each card carries a `stability` (how long the memory lasts)
// and `difficulty`. When you rate a review (Again/Hard/Good/Easy), the algorithm
// updates those and picks the next `due` date so that your predicted recall on that
// date equals your target `desiredRetention` (default 0.9). More stable cards get
// exponentially longer intervals — that's the spacing in "spaced repetition."

import {
  fsrs,
  generatorParameters,
  createEmptyCard,
  State,
  type FSRS,
  type Card,
  type ReviewLog,
  type Grade,
  type Rating,
} from "ts-fsrs";
import type { ReviewState, UserProfile, FsrsState } from "@/generated/prisma/client";

// --- enum mapping: our FsrsState (string) ⇄ ts-fsrs State (numeric) ---

const STATE_TO_FSRS: Record<FsrsState, State> = {
  NEW: State.New,
  LEARNING: State.Learning,
  REVIEW: State.Review,
  RELEARNING: State.Relearning,
};

const FSRS_TO_STATE: Record<State, FsrsState> = {
  [State.New]: "NEW",
  [State.Learning]: "LEARNING",
  [State.Review]: "REVIEW",
  [State.Relearning]: "RELEARNING",
};

/** Build a scheduler tuned to this user's preferences.
 *  An empty `fsrsParams` array means "use the library's default weights". */
export function schedulerFor(
  profile: Pick<UserProfile, "desiredRetention" | "fsrsParams">,
): FSRS {
  return fsrs(
    generatorParameters({
      request_retention: profile.desiredRetention,
      // Fuzz spreads intervals slightly so a big batch reviewed together doesn't all
      // come due on the exact same future day.
      enable_fuzz: true,
      ...(profile.fsrsParams.length > 0 ? { w: profile.fsrsParams } : {}),
    }),
  );
}

/** Our stored scheduling row → a ts-fsrs Card.
 *  A word that was never reviewed (no row) becomes a fresh empty card. */
export function toCard(state: ReviewState | null, now: Date = new Date()): Card {
  if (!state) return createEmptyCard(now);
  return {
    due: state.due,
    stability: state.stability ?? 0,
    difficulty: state.difficulty ?? 0,
    elapsed_days: state.elapsedDays,
    scheduled_days: state.scheduledDays,
    learning_steps: state.learningSteps,
    reps: state.reps,
    lapses: state.lapses,
    state: STATE_TO_FSRS[state.state],
    last_review: state.lastReview ?? undefined,
  };
}

/** A ts-fsrs Card → the columns we persist on `ReviewState`
 *  (relations/ids are added by the caller). */
export function fromCard(card: Card) {
  return {
    stability: card.stability,
    difficulty: card.difficulty,
    due: card.due,
    lastReview: card.last_review ?? null,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: FSRS_TO_STATE[card.state],
  };
}

/** A ts-fsrs ReviewLog → the columns we persist on `ReviewLog`. */
export function fromLog(log: ReviewLog) {
  return {
    rating: log.rating as number,
    state: FSRS_TO_STATE[log.state],
    due: log.due,
    stability: log.stability,
    difficulty: log.difficulty,
    elapsedDays: log.elapsed_days,
    scheduledDays: log.scheduled_days,
    learningSteps: log.learning_steps,
    reviewedAt: log.review,
  };
}

/** A stored `ReviewLog` row → a ts-fsrs ReviewLog, so `FSRS.rollback()` can undo it.
 *  `last_elapsed_days` is deprecated in ts-fsrs and isn't used to restore the prior
 *  due/stability/difficulty, so reusing `elapsedDays` here is a safe best-effort. */
export function toLog(row: {
  rating: number;
  state: FsrsState;
  due: Date;
  stability: number | null;
  difficulty: number | null;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reviewedAt: Date;
}): ReviewLog {
  return {
    rating: row.rating as Rating,
    state: STATE_TO_FSRS[row.state],
    due: row.due,
    stability: row.stability ?? 0,
    difficulty: row.difficulty ?? 0,
    elapsed_days: row.elapsedDays,
    last_elapsed_days: row.elapsedDays,
    scheduled_days: row.scheduledDays,
    learning_steps: row.learningSteps,
    review: row.reviewedAt,
  };
}

/** Valid rating values for `reviewWord` (Again/Hard/Good/Easy). */
export type ReviewRating = Grade; // 1 | 2 | 3 | 4
