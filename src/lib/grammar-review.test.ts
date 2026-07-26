// Characterization tests for the grammar review services (grammar-review.ts).
//
// **These deliberately mirror `review.test.ts` case for case**, because the modules they cover
// are deliberate near-duplicates: `undoLastGrammarReview` is line-for-line `undoLastReview` on
// different tables, accepted at this size rather than factored together (the source says so,
// and TODO.md notes a unified studiable-item model would retire it rather than fix it).
//
// Testing them in parallel is the point. Two implementations of one behaviour drift silently;
// a test file per queue asserting the same guarantees is what turns a drift into a failure.
// Where grammar genuinely differs — `dueCount`, the lesson/position ordering of new points,
// the `scheduledDays >= 21` maturity threshold, the absence of a distinct-word log — the test
// says which and why.

import { describe, it, expect } from "vitest";
import { makeFakeDb, type Row } from "@/lib/__fixtures__/fake-db";
import {
  GRAMMAR_LEVELS,
  getGrammarQueue,
  getGrammarStats,
  getSeededGrammarLevels,
  reviewGrammarPoint,
  undoLastGrammarReview,
} from "@/lib/grammar-review";
import { buildGrammarSession } from "@/lib/grammar-cards";
import { buildGrammarBrowse } from "@/lib/grammar-browse";

const USER = "user-1";
const LONG_AGO = new Date("2020-01-01T00:00:00Z");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function pointRow(id: string, overrides: Row = {}): Row {
  return {
    id,
    level: "N3",
    lesson: 1,
    lessonTitle: "Lesson 1",
    position: 1,
    pattern: `〜${id}`,
    reading: `〜${id}`,
    meanings: [`meaning of ${id}`],
    exampleJp: `これは${id}です。`,
    exampleEn: `This is ${id}.`,
    ...overrides,
  };
}

function progressRow(grammarPointId: string, due: Date, overrides: Row = {}): Row {
  return {
    id: `gp-${grammarPointId}`,
    userId: USER,
    grammarPointId,
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
    activeLevel: "N3",
    desiredRetention: 0.9,
    fsrsParams: [],
    newCardsPerDay: 10,
    onboardedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// GRAMMAR_LEVELS
// ---------------------------------------------------------------------------

describe("GRAMMAR_LEVELS", () => {
  it("is the five JLPT levels as plain strings", () => {
    // Plain strings, not the vocab `Level` enum: `GrammarPoint.level` is a String column so a
    // new deck needs no migration (SPEC §4.1). The two representations diverging is one of the
    // three schema problems the migration is meant to resolve, so pin the current answer.
    expect([...GRAMMAR_LEVELS].sort()).toEqual(["N1", "N2", "N3", "N4", "N5"]);
  });
});

// ---------------------------------------------------------------------------
// reviewGrammarPoint / undoLastGrammarReview
// ---------------------------------------------------------------------------

describe("reviewGrammarPoint", () => {
  it("creates progress and a log row for a never-seen point", async () => {
    const fake = makeFakeDb({ grammarPoint: [pointRow("g1")], userProfile: [profileRow()] });

    await reviewGrammarPoint(USER, "g1", 3, fake.deps);

    expect(fake.tables.grammarProgress).toHaveLength(1);
    // The log is written inside the same transaction as the upsert, so a rating can never be
    // persisted without the means to reverse it — which would show an Undo button that fails.
    expect(fake.tables.grammarReviewLog).toHaveLength(1);
    expect(fake.tables.grammarProgress[0].reps).toBe(1);
  });

  it("updates the existing progress row rather than inserting a second", async () => {
    const fake = makeFakeDb({
      grammarPoint: [pointRow("g1")],
      userProfile: [profileRow()],
      grammarProgress: [progressRow("g1", LONG_AGO)],
    });
    await reviewGrammarPoint(USER, "g1", 3, fake.deps);
    expect(fake.tables.grammarProgress).toHaveLength(1);
    expect(fake.tables.grammarProgress[0].reps).toBe(5);
  });

  it("schedules a lapse sooner than a success", async () => {
    const again = makeFakeDb({ grammarPoint: [pointRow("g1")], userProfile: [profileRow()] });
    const easy = makeFakeDb({ grammarPoint: [pointRow("g1")], userProfile: [profileRow()] });
    const a = await reviewGrammarPoint(USER, "g1", 1, again.deps);
    const e = await reviewGrammarPoint(USER, "g1", 4, easy.deps);
    expect(a.due.getTime()).toBeLessThan(e.due.getTime());
  });
});

describe("undoLastGrammarReview", () => {
  it("restores the memory state exactly and drops the log row", async () => {
    const fake = makeFakeDb({ grammarPoint: [pointRow("g1")], userProfile: [profileRow()] });
    const before = progressRow("g1", LONG_AGO);
    fake.tables.grammarProgress.push({ ...before });

    await reviewGrammarPoint(USER, "g1", 4, fake.deps);
    await undoLastGrammarReview(USER, "g1", fake.deps);

    const after = fake.tables.grammarProgress[0];
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
    expect(fake.tables.grammarReviewLog).toHaveLength(0);
  });

  it("leaves the card due immediately, exactly as the vocab queue does", async () => {
    // The same `rollback` quirk documented at length in `review.test.ts`. Asserted on both
    // queues on purpose: the two undos are hand-duplicated, so "they behave identically" is a
    // claim that needs checking rather than assuming.
    const fake = makeFakeDb({ grammarPoint: [pointRow("g1")], userProfile: [profileRow()] });
    fake.tables.grammarProgress.push(progressRow("g1", LONG_AGO));

    const ratedAt = Date.now();
    await reviewGrammarPoint(USER, "g1", 4, fake.deps);
    await undoLastGrammarReview(USER, "g1", fake.deps);

    const restored = (fake.tables.grammarProgress[0].due as Date).getTime();
    expect(restored).not.toBe(LONG_AGO.getTime());
    expect(restored).toBeGreaterThanOrEqual(ratedAt);
  });

  it("returns null when there is no progress row or no log row", async () => {
    const empty = makeFakeDb({ grammarPoint: [pointRow("g1")], userProfile: [profileRow()] });
    expect(await undoLastGrammarReview(USER, "g1", empty.deps)).toBeNull();

    // A point rated before `GrammarReviewLog` existed has progress but no log. Correctly not
    // undoable, and deliberately not backfilled: undo only ever reaches one rating back.
    const noLog = makeFakeDb({
      grammarPoint: [pointRow("g1")],
      userProfile: [profileRow()],
      grammarProgress: [progressRow("g1", LONG_AGO)],
    });
    expect(await undoLastGrammarReview(USER, "g1", noLog.deps)).toBeNull();
  });

  it("does not touch another user's review of the same point", async () => {
    const fake = makeFakeDb({ grammarPoint: [pointRow("g1")], userProfile: [profileRow()] });
    await reviewGrammarPoint(USER, "g1", 3, fake.deps);
    await reviewGrammarPoint("user-2", "g1", 3, fake.deps);

    await undoLastGrammarReview(USER, "g1", fake.deps);

    expect(fake.tables.grammarReviewLog).toHaveLength(1);
    expect(fake.tables.grammarReviewLog[0].userId).toBe("user-2");
  });
});

// ---------------------------------------------------------------------------
// getGrammarQueue
// ---------------------------------------------------------------------------

describe("getGrammarQueue", () => {
  function seed(totalPoints: number, dueCount: number, profile: Row = profileRow()) {
    const grammarPoint = Array.from({ length: totalPoints }, (_, i) =>
      pointRow(`g${i + 1}`, { position: i + 1 }),
    );
    const grammarProgress = Array.from({ length: dueCount }, (_, i) =>
      progressRow(`g${i + 1}`, new Date(LONG_AGO.getTime() + i * 60_000)),
    );
    return makeFakeDb({ grammarPoint, userProfile: [profile], grammarProgress });
  }

  it("returns due points oldest-first", async () => {
    const { due } = await getGrammarQueue(USER, {}, seed(10, 4).deps);
    expect(due.map((d) => d.grammarPointId)).toEqual(["g1", "g2", "g3", "g4"]);
  });

  it("caps due points at the session limit and reports the pre-cap total", async () => {
    const { due, totalDue } = await getGrammarQueue(USER, { sessionLimit: 5 }, seed(30, 12).deps);
    expect(due).toHaveLength(5);
    expect(totalDue).toBe(12);
  });

  it("fills the rest with new points, capped by newCardsPerDay", async () => {
    const fake = seed(50, 3, profileRow({ newCardsPerDay: 4 }));
    const { due, newPoints } = await getGrammarQueue(USER, { sessionLimit: 20 }, fake.deps);
    expect(due).toHaveLength(3);
    expect(newPoints).toHaveLength(4); // min(20 − 3, 4)
  });

  it("scopes new points to the level but NOT due points", async () => {
    // The same deliberate asymmetry as vocab: nothing already in progress gets stranded when
    // the user switches level.
    const fake = makeFakeDb({
      grammarPoint: [
        pointRow("n2-old", { level: "N2" }),
        ...Array.from({ length: 5 }, (_, i) => pointRow(`n3-${i}`, { level: "N3", position: i })),
      ],
      userProfile: [profileRow()],
      grammarProgress: [progressRow("n2-old", LONG_AGO)],
    });

    const { due, newPoints } = await getGrammarQueue(USER, { level: "N3" }, fake.deps);

    expect(due.map((d) => d.grammarPointId)).toEqual(["n2-old"]);
    expect(newPoints.every((p) => p.level === "N3")).toBe(true);
  });

  it("never offers an already-started point as new", async () => {
    const fake = seed(10, 3);
    const { newPoints } = await getGrammarQueue(USER, {}, fake.deps);
    expect(newPoints.map((p) => p.id)).not.toContain("g1");
  });

  it("joins the full grammar point onto each due row", async () => {
    const { due } = await getGrammarQueue(USER, {}, seed(3, 1).deps);
    expect(due[0].grammarPoint.pattern).toBe("〜g1");
  });
});

// ---------------------------------------------------------------------------
// buildGrammarSession
// ---------------------------------------------------------------------------

describe("buildGrammarSession", () => {
  it("puts due cards first, strips the FSRS internals, and reports dueCount exactly", async () => {
    const fake = makeFakeDb({
      grammarPoint: Array.from({ length: 6 }, (_, i) => pointRow(`g${i + 1}`, { position: i + 1 })),
      userProfile: [profileRow({ newCardsPerDay: 2 })],
      grammarProgress: [
        progressRow("g1", LONG_AGO),
        progressRow("g2", new Date(LONG_AGO.getTime() + 60_000)),
      ],
    });

    const { cards, totalDue, dueCount } = await buildGrammarSession(USER, { level: "N3" }, fake.deps);

    expect(cards.slice(0, 2).map((c) => c.grammarPointId)).toEqual(["g1", "g2"]);
    expect(cards).toHaveLength(4);
    expect(totalDue).toBe(2);
    // The one field vocab's payload cannot supply: grammar tracks the due/new split through the
    // queue, so its "N more waiting" hint is exact rather than an estimate. Documented as a
    // real difference, so a future unification does not quietly drop the precision.
    expect(dueCount).toBe(2);
    expect(Object.keys(cards[0]).sort()).toEqual([
      "exampleEn",
      "exampleJp",
      "grammarPointId",
      "meanings",
      "pattern",
      "reading",
    ]);
  });
});

// ---------------------------------------------------------------------------
// getGrammarStats
// ---------------------------------------------------------------------------

describe("getGrammarStats", () => {
  it("counts total, started, mature and due for one level", async () => {
    const now = Date.now();
    const fake = makeFakeDb({
      grammarPoint: [
        pointRow("g1"),
        pointRow("g2"),
        pointRow("g3"),
        pointRow("other", { level: "N2" }),
      ],
      grammarProgress: [
        progressRow("g1", new Date(now - 60_000), { scheduledDays: 30 }), // due + mature
        progressRow("g2", new Date(now + 86_400_000), { scheduledDays: 5 }), // started only
        progressRow("other", new Date(now - 60_000), { scheduledDays: 30 }), // wrong level
      ],
    });

    const stats = await getGrammarStats(USER, "N3", fake.deps);

    expect(stats.total).toBe(3); // level-scoped: "other" excluded
    expect(stats.started).toBe(2);
    expect(stats.mature).toBe(1); // scheduledDays >= 21
    expect(stats.dueNow).toBe(1);
  });

  it("treats scheduledDays of exactly 21 as mature", async () => {
    // The threshold is `gte: 21`. A boundary worth pinning: it is duplicated in
    // `grammar-browse.ts` as a literal, so the two can disagree.
    const fake = makeFakeDb({
      grammarPoint: [pointRow("g1"), pointRow("g2")],
      grammarProgress: [
        progressRow("g1", LONG_AGO, { scheduledDays: 21 }),
        progressRow("g2", LONG_AGO, { scheduledDays: 20 }),
      ],
    });
    expect((await getGrammarStats(USER, "N3", fake.deps)).mature).toBe(1);
  });

  it("counts points touched today, not review events", async () => {
    // `GrammarProgress` holds only the latest review per point, so this can only ever be a
    // per-point count. That unit difference from vocab is what `getHomeSnapshot` de-duplicates
    // against, and it is why the hub's number means "cards studied" rather than "ratings".
    const today = new Date();
    today.setHours(9, 0, 0, 0);
    const fake = makeFakeDb({
      grammarPoint: [pointRow("g1"), pointRow("g2")],
      grammarProgress: [
        progressRow("g1", LONG_AGO, { lastReview: today }),
        progressRow("g2", LONG_AGO, { lastReview: new Date("2020-01-01T00:00:00Z") }),
      ],
    });
    const stats = await getGrammarStats(USER, "N3", fake.deps);
    expect(stats.studiedTodayCount).toBe(1);
    expect(stats.studiedToday).toBe(true);
  });

  it("reports all zeros and studiedToday false for a level with no deck", async () => {
    // The empty-deck case the grammar hub must distinguish from "all caught up", or it tells
    // the user they finished a deck that does not exist.
    const stats = await getGrammarStats(USER, "N1", makeFakeDb({}).deps);
    expect(stats).toMatchObject({ total: 0, started: 0, mature: 0, dueNow: 0, studiedToday: false });
  });
});

// ---------------------------------------------------------------------------
// getSeededGrammarLevels
// ---------------------------------------------------------------------------

describe("getSeededGrammarLevels", () => {
  it("returns the distinct levels that actually have points", async () => {
    // Derived from the table rather than hardcoded to "N3": a literal would go wrong silently
    // the moment a second deck lands, and the level picker would keep marking it empty.
    const fake = makeFakeDb({
      grammarPoint: [pointRow("a", { level: "N3" }), pointRow("b", { level: "N3" }), pointRow("c", { level: "N2" })],
    });
    expect([...(await getSeededGrammarLevels(fake.deps))].sort()).toEqual(["N2", "N3"]);
  });

  it("returns an empty set when nothing is seeded", async () => {
    expect((await getSeededGrammarLevels(makeFakeDb({}).deps)).size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildGrammarBrowse
// ---------------------------------------------------------------------------

describe("buildGrammarBrowse", () => {
  it("groups points by lesson in lesson then position order", async () => {
    const fake = makeFakeDb({
      grammarPoint: [
        pointRow("b", { lesson: 1, position: 2, lessonTitle: "One" }),
        pointRow("c", { lesson: 2, position: 1, lessonTitle: "Two" }),
        pointRow("a", { lesson: 1, position: 1, lessonTitle: "One" }),
      ],
    });

    const lessons = await buildGrammarBrowse(USER, "N3", fake.deps);

    expect(lessons.map((l) => l.lesson)).toEqual([1, 2]);
    expect(lessons[0].title).toBe("One");
    expect(lessons[0].points.map((p) => p.id)).toEqual(["a", "b"]);
    expect(lessons[1].points.map((p) => p.id)).toEqual(["c"]);
  });

  it("annotates each point as new, started or mature", async () => {
    const fake = makeFakeDb({
      grammarPoint: [
        pointRow("new", { position: 1 }),
        pointRow("started", { position: 2 }),
        pointRow("mature", { position: 3 }),
      ],
      grammarProgress: [
        progressRow("started", LONG_AGO, { scheduledDays: 5 }),
        progressRow("mature", LONG_AGO, { scheduledDays: 21 }),
      ],
    });

    const points = (await buildGrammarBrowse(USER, "N3", fake.deps)).flatMap((l) => l.points);

    expect(points.map((p) => p.status)).toEqual(["new", "started", "mature"]);
  });

  it("does not leak another user's progress into the annotations", async () => {
    const fake = makeFakeDb({
      grammarPoint: [pointRow("g1")],
      grammarProgress: [progressRow("g1", LONG_AGO, { userId: "user-2", scheduledDays: 30 })],
    });
    const points = (await buildGrammarBrowse(USER, "N3", fake.deps)).flatMap((l) => l.points);
    expect(points[0].status).toBe("new");
  });

  it("returns an empty list for a level with no deck", async () => {
    expect(await buildGrammarBrowse(USER, "N1", makeFakeDb({}).deps)).toEqual([]);
  });
});
