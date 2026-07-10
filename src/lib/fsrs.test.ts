// Tests for the FSRS adapter (fsrs.ts) — the pure translation layer between our
// Prisma rows and ts-fsrs shapes.
//
// Why start testing HERE: this is the one module where a silent bug corrupts
// long-lived user data. A mis-mapped field (say, scheduledDays written into
// elapsedDays) wouldn't crash anything — every review would just quietly compute
// wrong intervals, and weeks of scheduling state would drift before anyone noticed.
// The module is also pure (no DB, no I/O), so it's the cheapest possible thing to
// test. The strategy is round-tripping: persist → restore must be lossless, because
// that's exactly the cycle every card goes through between two study sessions.

import { describe, it, expect } from "vitest";
import { createEmptyCard, State, type Grade, type ReviewLog } from "ts-fsrs";
import { schedulerFor, toCard, fromCard, fromLog, toLog, type CardLike } from "@/lib/fsrs";

// A default-tuned profile, as used when no UserProfile row exists yet.
const PROFILE = { desiredRetention: 0.9, fsrsParams: [] as number[] };

/** A realistic mid-life REVIEW-state row, as it would come out of Postgres. */
function reviewRow(): CardLike {
  return {
    due: new Date("2026-07-12T09:00:00Z"),
    stability: 3.5,
    difficulty: 5.2,
    elapsedDays: 2,
    scheduledDays: 3,
    learningSteps: 0,
    reps: 4,
    lapses: 1,
    state: "REVIEW",
    lastReview: new Date("2026-07-09T09:00:00Z"),
  };
}

describe("toCard", () => {
  it("turns null (never-reviewed) into a fresh empty card due now", () => {
    const now = new Date("2026-07-10T00:00:00Z");
    const card = toCard(null, now);
    expect(card).toEqual(createEmptyCard(now));
    expect(card.state).toBe(State.New);
    expect(card.reps).toBe(0);
  });

  it("maps a stored row onto ts-fsrs field names", () => {
    const row = reviewRow();
    const card = toCard(row);
    // Spot-check the snake_case renames — these are the mappings a refactor could
    // silently swap without a type error (all are `number`).
    expect(card.elapsed_days).toBe(row.elapsedDays);
    expect(card.scheduled_days).toBe(row.scheduledDays);
    expect(card.learning_steps).toBe(row.learningSteps);
    expect(card.state).toBe(State.Review);
    expect(card.last_review).toBe(row.lastReview);
  });

  it("defaults null stability/difficulty to 0 and null lastReview to undefined", () => {
    const row: CardLike = { ...reviewRow(), stability: null, difficulty: null, lastReview: null };
    const card = toCard(row);
    expect(card.stability).toBe(0);
    expect(card.difficulty).toBe(0);
    expect(card.last_review).toBeUndefined();
  });
});

describe("fromCard ∘ toCard (persistence round-trip)", () => {
  it("is lossless for a stored row", () => {
    // fromCard returns exactly the CardLike columns, so restoring a row into a Card
    // and persisting it again must reproduce the row bit-for-bit. This is the cycle
    // every card goes through between sessions.
    const row = reviewRow();
    expect(fromCard(toCard(row))).toEqual(row);
  });

  it("round-trips every FSRS state", () => {
    // The string ⇄ numeric enum mapping is two hand-written tables; this catches a
    // missing or crossed entry if a state is ever added or renamed.
    for (const state of ["NEW", "LEARNING", "REVIEW", "RELEARNING"] as const) {
      const row = { ...reviewRow(), state };
      expect(fromCard(toCard(row)).state).toBe(state);
    }
  });
});

describe("toLog ∘ fromLog (review-log round-trip)", () => {
  it("preserves everything rollback() needs", () => {
    // Get a REAL log by rating a card, rather than hand-building one — this keeps the
    // test honest about what ts-fsrs actually emits.
    const now = new Date("2026-07-10T00:00:00Z");
    const { log } = schedulerFor(PROFILE).next(toCard(null, now), now, 3 as Grade);

    const restored = toLog(fromLog(log));
    // last_elapsed_days is deprecated in ts-fsrs and not persisted (toLog reuses
    // elapsedDays as a best-effort) — compare everything else exactly.
    const expected: Partial<ReviewLog> = { ...log };
    const actual: Partial<ReviewLog> = { ...restored };
    delete expected.last_elapsed_days;
    delete actual.last_elapsed_days;
    expect(actual).toEqual(expected);
  });
});

describe("review → undo cycle (the paths review.ts wires together)", () => {
  it("rating a new card advances it out of NEW", () => {
    const now = new Date("2026-07-10T00:00:00Z");
    const { card: next } = schedulerFor(PROFILE).next(toCard(null, now), now, 3 as Grade);
    const persisted = fromCard(next);
    expect(persisted.state).toBe("LEARNING");
    expect(persisted.reps).toBe(1);
    expect(persisted.lastReview).toEqual(now);
    expect(persisted.due.getTime()).toBeGreaterThan(now.getTime());
  });

  it("rollback through persisted rows restores the pre-review card", () => {
    // Simulate the full undo path: rate → persist card+log → restore both from
    // "storage" → rollback. The result must equal the original empty card, which is
    // what undoLastReview relies on to revert a mistaken rating.
    const now = new Date("2026-07-10T00:00:00Z");
    const scheduler = schedulerFor(PROFILE);
    const original = toCard(null, now);

    const { card: next, log } = scheduler.next(original, now, 4 as Grade);
    const cardRow = fromCard(next); // what reviewWord writes to ReviewState
    const logRow = fromLog(log); //   what reviewWord writes to ReviewLog

    const rolledBack = scheduler.rollback(toCard(cardRow), toLog(logRow));
    expect(fromCard(rolledBack)).toEqual(fromCard(original));
  });
});
