// Characterization tests for the vocabulary review services (review.ts).
//
// Three things are pinned here, in order of how badly a silent change would hurt:
//
//   1. **rate → persist → undo round-trips.** A rating writes scheduling state that lives for
//      months. If undo restored the wrong prior state the user would see nothing wrong, and
//      the card's schedule would simply be quietly incorrect from then on.
//   2. **The queue's ordering and caps.** Due-first, oldest-first, capped by the session limit
//      and then by the new-card pace. TODO.md singles this out: ordering is exactly the kind
//      of behaviour that survives a port syntactically while changing semantically.
//   3. **The level-scoping asymmetry.** New words are level-scoped; due cards are not. That
//      looks like a bug until you know it is deliberate (nothing in progress gets stranded),
//      which is precisely why it needs a test saying so.
//
// The fake database runs `serializableTxn` inline, so these cannot test the lost-update race
// the SERIALIZABLE isolation level exists to prevent. That needs a real database and is called
// out in the fake's header; what is testable here is that the read-compute-write sequence
// inside the transaction is right.

import { describe, it, expect } from "vitest";
import { makeFakeDb, type Row } from "@/lib/__fixtures__/fake-db";
import { getStudyQueue, reviewWord, undoLastReview } from "@/lib/review";
import { buildSession } from "@/lib/study-cards";
import { Level } from "@/generated/prisma/enums";

const USER = "user-1";
const NOW = new Date("2026-07-27T12:00:00Z");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function wordRow(id: string, level: Level = Level.N5): Row {
  return {
    id,
    expression: `語${id}`,
    reading: `ご${id}`,
    meaning: `gloss ${id}`,
    level,
  };
}

/** A `ReviewState` row with every FSRS column a scheduler read needs. */
function stateRow(wordId: string, due: Date, overrides: Row = {}): Row {
  return {
    id: `rs-${wordId}`,
    userId: USER,
    wordId,
    due,
    stability: 3.5,
    difficulty: 5.2,
    elapsedDays: 2,
    scheduledDays: 3,
    learningSteps: 0,
    reps: 4,
    lapses: 1,
    state: "REVIEW",
    lastReview: new Date("2026-07-24T12:00:00Z"),
    ...overrides,
  };
}

function profileRow(overrides: Row = {}): Row {
  return {
    id: "p-1",
    userId: USER,
    activeLevel: Level.N5,
    desiredRetention: 0.9,
    fsrsParams: [],
    newCardsPerDay: 10,
    onboardedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// reviewWord
// ---------------------------------------------------------------------------

describe("reviewWord", () => {
  it("creates a ReviewState and a ReviewLog for a never-seen word", async () => {
    const fake = makeFakeDb({ word: [wordRow("w1")], userProfile: [profileRow()] });

    const result = await reviewWord(USER, "w1", 3, fake.deps);

    expect(fake.tables.reviewState).toHaveLength(1);
    expect(fake.tables.reviewLog).toHaveLength(1);
    const persisted = fake.tables.reviewState[0];
    expect(persisted.userId).toBe(USER);
    expect(persisted.wordId).toBe("w1");
    // A first rating always leaves NEW — that is what "started" means everywhere else in the
    // app (`getStartedWordIds`, the hub's progress bar) so it is load-bearing beyond FSRS.
    expect(persisted.state).not.toBe("NEW");
    expect(persisted.reps).toBe(1);
    expect(result.due).toBeInstanceOf(Date);
  });

  it("updates the existing state rather than inserting a second row", async () => {
    const fake = makeFakeDb({
      word: [wordRow("w1")],
      userProfile: [profileRow()],
      reviewState: [stateRow("w1", new Date("2026-07-26T12:00:00Z"))],
    });

    await reviewWord(USER, "w1", 3, fake.deps);

    // The upsert is keyed on (userId, wordId). A second row here would mean a user could
    // accumulate conflicting schedules for one word, and the queue would show duplicates.
    expect(fake.tables.reviewState).toHaveLength(1);
    expect(fake.tables.reviewState[0].reps).toBe(5); // was 4
  });

  it("appends a log per rating rather than overwriting", async () => {
    const fake = makeFakeDb({ word: [wordRow("w1")], userProfile: [profileRow()] });
    await reviewWord(USER, "w1", 3, fake.deps);
    await reviewWord(USER, "w1", 3, fake.deps);
    expect(fake.tables.reviewLog).toHaveLength(2);
  });

  it("schedules a lapse sooner than a success", async () => {
    // The core FSRS promise, asserted at the service boundary rather than on interval maths:
    // "Again" must bring a card back sooner than "Easy" does.
    const again = makeFakeDb({ word: [wordRow("w1")], userProfile: [profileRow()] });
    const easy = makeFakeDb({ word: [wordRow("w1")], userProfile: [profileRow()] });

    const a = await reviewWord(USER, "w1", 1, again.deps);
    const e = await reviewWord(USER, "w1", 4, easy.deps);

    expect(a.due.getTime()).toBeLessThan(e.due.getTime());
  });

  it("falls back to the schema-default study settings when the user has no profile row", async () => {
    // Reaching study before onboarding completes is a real path (both login routes create the
    // profile lazily). It must schedule, not throw.
    const fake = makeFakeDb({ word: [wordRow("w1")] });
    await expect(reviewWord(USER, "w1", 3, fake.deps)).resolves.toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// undoLastReview
// ---------------------------------------------------------------------------

describe("undoLastReview", () => {
  it("restores the memory state exactly and drops the log row", async () => {
    const fake = makeFakeDb({ word: [wordRow("w1")], userProfile: [profileRow()] });
    const before = stateRow("w1", new Date("2026-07-26T12:00:00Z"));
    fake.tables.reviewState.push({ ...before });

    await reviewWord(USER, "w1", 4, fake.deps);
    expect(fake.tables.reviewLog).toHaveLength(1);

    await undoLastReview(USER, "w1", fake.deps);

    // Every column that describes the *memory* goes back where it was. Checked field by field
    // rather than by spot check: a rollback that restored `reps` but not `stability` would
    // look correct on screen and schedule wrongly for months afterwards.
    const after = fake.tables.reviewState[0];
    for (const field of [
      "stability",
      "difficulty",
      "elapsedDays",
      "scheduledDays",
      "reps",
      "lapses",
      "state",
      "lastReview",
    ] as const) {
      expect({ [field]: after[field] }).toEqual({ [field]: before[field] });
    }
    expect(fake.tables.reviewLog).toHaveLength(0);
  });

  it("**does not** restore the original due date — undo leaves the card due immediately", async () => {
    // A finding, recorded rather than fixed (mid-freeze; see TODO.md and DECISIONS.md).
    //
    // `ts-fsrs`'s `rollback(card, log)` reconstructs `due` from the log's *review timestamp*,
    // not from the card's previous due date, so an undone card becomes due at the instant the
    // undo happened. `fsrs.test.ts` misses this because it rolls back an empty card, whose
    // original due already equals `now`.
    //
    // Impact today is near zero: undo exists to reverse a mis-tap seconds later, and the card
    // was already in the due queue when it was rated, so "due now" is where it came from.
    // It would matter for a card rated ahead of schedule — which the queue never serves.
    // Pinned here so the Nuxt port reproduces it knowingly, or changes it deliberately.
    const fake = makeFakeDb({ word: [wordRow("w1")], userProfile: [profileRow()] });
    const originalDue = new Date("2026-07-26T12:00:00Z");
    fake.tables.reviewState.push(stateRow("w1", originalDue));

    const ratedAt = Date.now();
    await reviewWord(USER, "w1", 4, fake.deps);
    const result = await undoLastReview(USER, "w1", fake.deps);
    const finishedAt = Date.now();

    const restoredDue = (fake.tables.reviewState[0].due as Date).getTime();
    expect(restoredDue).not.toBe(originalDue.getTime());
    expect(restoredDue).toBeGreaterThanOrEqual(ratedAt);
    expect(restoredDue).toBeLessThanOrEqual(finishedAt);
    expect(result?.due.getTime()).toBe(restoredDue);
  });

  it("undoes only the most recent rating when several are stacked", async () => {
    const fake = makeFakeDb({ word: [wordRow("w1")], userProfile: [profileRow()] });
    await reviewWord(USER, "w1", 3, fake.deps);
    const afterFirst = { ...fake.tables.reviewState[0] };
    await reviewWord(USER, "w1", 3, fake.deps);

    await undoLastReview(USER, "w1", fake.deps);

    expect(fake.tables.reviewLog).toHaveLength(1); // the first rating's log survives
    expect(fake.tables.reviewState[0].reps).toBe(afterFirst.reps);
  });

  it("returns null when there is nothing to undo", async () => {
    // Both halves of "nothing to undo": no state at all, and state with no log (every grammar
    // and vocab card rated before the log tables existed is in the second category).
    const empty = makeFakeDb({ word: [wordRow("w1")], userProfile: [profileRow()] });
    expect(await undoLastReview(USER, "w1", empty.deps)).toBeNull();

    const stateOnly = makeFakeDb({
      word: [wordRow("w1")],
      userProfile: [profileRow()],
      reviewState: [stateRow("w1", NOW)],
    });
    expect(await undoLastReview(USER, "w1", stateOnly.deps)).toBeNull();
  });

  it("does not touch another user's review of the same word", async () => {
    // Scoping, asserted because every query in this module takes `userId` and a dropped
    // clause would be invisible in a single-user test.
    const fake = makeFakeDb({ word: [wordRow("w1")], userProfile: [profileRow()] });
    await reviewWord(USER, "w1", 3, fake.deps);
    await reviewWord("user-2", "w1", 3, fake.deps);
    expect(fake.tables.reviewLog).toHaveLength(2);

    await undoLastReview(USER, "w1", fake.deps);

    expect(fake.tables.reviewLog).toHaveLength(1);
    expect(fake.tables.reviewLog[0].userId).toBe("user-2");
    expect(fake.tables.reviewState.filter((r) => r.userId === "user-2")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// getStudyQueue
// ---------------------------------------------------------------------------

describe("getStudyQueue", () => {
  /** Words w1..wN, with the first `dueCount` of them due at staggered past times. */
  function seedQueue(total: number, dueCount: number, profile: Row = profileRow()) {
    const word = Array.from({ length: total }, (_, i) => wordRow(`w${i + 1}`));
    const reviewState = Array.from({ length: dueCount }, (_, i) =>
      // w1 is the most overdue, wN the least: oldest-first ordering is observable.
      stateRow(`w${i + 1}`, new Date(NOW.getTime() - (dueCount - i) * 60_000)),
    );
    return makeFakeDb({ word, userProfile: [profile], reviewState });
  }

  it("returns due cards oldest-first", async () => {
    const fake = seedQueue(10, 5);
    const { due } = await getStudyQueue(USER, { now: NOW }, fake.deps);
    expect(due.map((d) => d.wordId)).toEqual(["w1", "w2", "w3", "w4", "w5"]);
  });

  it("excludes cards that are not yet due", async () => {
    const fake = makeFakeDb({
      word: [wordRow("w1"), wordRow("w2")],
      userProfile: [profileRow()],
      reviewState: [
        stateRow("w1", new Date(NOW.getTime() - 60_000)), // due
        stateRow("w2", new Date(NOW.getTime() + 60_000)), // not yet
      ],
    });
    const { due } = await getStudyQueue(USER, { now: NOW }, fake.deps);
    expect(due.map((d) => d.wordId)).toEqual(["w1"]);
  });

  it("treats a card due exactly now as due", async () => {
    const fake = makeFakeDb({
      word: [wordRow("w1")],
      userProfile: [profileRow()],
      reviewState: [stateRow("w1", NOW)],
    });
    // `due: { lte: now }` — the boundary is inclusive. A port that writes `lt` delays every
    // card by one scheduling tick, which no user would ever report as a bug.
    expect((await getStudyQueue(USER, { now: NOW }, fake.deps)).due).toHaveLength(1);
  });

  it("caps due cards at the session limit but reports the true total", async () => {
    const fake = seedQueue(30, 25);
    const { due, totalDue } = await getStudyQueue(USER, { now: NOW, sessionLimit: 20 }, fake.deps);
    expect(due).toHaveLength(20);
    // The pre-cap count, which is what the completion screen's "N more waiting" hint needs.
    expect(totalDue).toBe(25);
  });

  it("fills the remaining slots with new words, capped by newCardsPerDay", async () => {
    const fake = seedQueue(50, 5, profileRow({ newCardsPerDay: 10 }));
    const { due, newWords } = await getStudyQueue(USER, { now: NOW, sessionLimit: 20 }, fake.deps);
    expect(due).toHaveLength(5);
    // min(sessionLimit − due, newCardsPerDay) = min(15, 10).
    expect(newWords).toHaveLength(10);
  });

  it("adds no new words when due cards already fill the session", async () => {
    const fake = seedQueue(50, 25);
    const { due, newWords } = await getStudyQueue(USER, { now: NOW, sessionLimit: 20 }, fake.deps);
    expect(due).toHaveLength(20);
    expect(newWords).toHaveLength(0);
  });

  it("never offers a word the user has already started as new", async () => {
    const fake = seedQueue(10, 3);
    const { due, newWords } = await getStudyQueue(USER, { now: NOW }, fake.deps);
    const dueIds = new Set(due.map((d) => d.wordId));
    for (const w of newWords) expect(dueIds.has(w.id)).toBe(false);
    // Including cards that exist but are not yet due — "new" means no ReviewState at all.
    expect(newWords.map((w) => w.id)).not.toContain("w1");
  });

  it("scopes new words to the level but NOT due cards", async () => {
    // The deliberate asymmetry. A user studying N5 who has an in-progress N3 card must still
    // be shown it; otherwise switching level silently strands everything already learned.
    const fake = makeFakeDb({
      word: [wordRow("n3-old", Level.N3), ...Array.from({ length: 10 }, (_, i) => wordRow(`n5-${i}`, Level.N5))],
      userProfile: [profileRow()],
      reviewState: [stateRow("n3-old", new Date(NOW.getTime() - 60_000))],
    });

    const { due, newWords } = await getStudyQueue(USER, { level: Level.N5, now: NOW }, fake.deps);

    expect(due.map((d) => d.wordId)).toEqual(["n3-old"]); // level-agnostic
    expect(newWords.every((w) => String(w.level) === Level.N5)).toBe(true); // level-scoped
  });

  it("joins at most one example sentence per card", async () => {
    const fake = makeFakeDb({
      word: [wordRow("w1")],
      userProfile: [profileRow()],
      reviewState: [stateRow("w1", new Date(NOW.getTime() - 60_000))],
      exampleSentence: [
        { id: "s1", wordId: "w1", japanese: "一", reading: "いち", english: "one" },
        { id: "s2", wordId: "w1", japanese: "二", reading: "に", english: "two" },
      ],
    });
    const { due } = await getStudyQueue(USER, { now: NOW }, fake.deps);
    expect(due[0].word.sentences).toHaveLength(1);
  });

  it("ignores another user's review state entirely", async () => {
    const fake = makeFakeDb({
      word: [wordRow("w1"), wordRow("w2")],
      userProfile: [profileRow()],
      reviewState: [stateRow("w1", new Date(NOW.getTime() - 60_000), { userId: "user-2", id: "rs-other" })],
    });
    const { due, totalDue, newWords } = await getStudyQueue(USER, { now: NOW }, fake.deps);
    expect(due).toHaveLength(0);
    expect(totalDue).toBe(0);
    // And w1 is *new* to this user, because "seen" is per-user.
    expect(newWords.map((w) => w.id).sort()).toEqual(["w1", "w2"]);
  });
});

// ---------------------------------------------------------------------------
// buildSession — the flattening the client actually receives
// ---------------------------------------------------------------------------

describe("buildSession", () => {
  // `buildSession` takes no injectable clock — it forwards to `getStudyQueue` without a `now`,
  // so the queue uses the real wall clock. These fixtures therefore use absolute dates well in
  // the past rather than offsets from the `NOW` constant, which is itself a fixed instant and
  // may sit on either side of the real one depending on when the suite runs.
  const LONG_AGO = new Date("2020-01-01T00:00:00Z");

  it("puts due cards before new ones and strips the FSRS internals", async () => {
    const fake = makeFakeDb({
      word: Array.from({ length: 6 }, (_, i) => wordRow(`w${i + 1}`)),
      userProfile: [profileRow({ newCardsPerDay: 2 })],
      reviewState: [
        stateRow("w1", new Date(LONG_AGO.getTime())),
        stateRow("w2", new Date(LONG_AGO.getTime() + 60_000)),
      ],
    });

    const { cards, totalDue } = await buildSession(USER, { level: Level.N5, sessionLimit: 20 }, fake.deps);

    expect(cards.slice(0, 2).map((c) => c.wordId)).toEqual(["w1", "w2"]); // due first, oldest first
    expect(cards).toHaveLength(4); // 2 due + 2 new
    expect(totalDue).toBe(2);
    // The payload contract: five fields, none of them scheduling state. Shipping `stability`
    // to a browser that cannot act on it is payload with no consumer.
    expect(Object.keys(cards[0]).sort()).toEqual(["expression", "meaning", "reading", "sentence", "wordId"]);
  });

  it("carries a card's first sentence through, or null when it has none", async () => {
    const fake = makeFakeDb({
      word: [wordRow("w1"), wordRow("w2")],
      userProfile: [profileRow({ newCardsPerDay: 2 })],
      exampleSentence: [{ id: "s1", wordId: "w1", japanese: "一", reading: "いち", english: "one" }],
    });
    const { cards } = await buildSession(USER, {}, fake.deps);
    expect(cards.find((c) => c.wordId === "w1")?.sentence).toEqual({
      japanese: "一",
      reading: "いち",
      english: "one",
    });
    expect(cards.find((c) => c.wordId === "w2")?.sentence).toBeNull();
  });
});
