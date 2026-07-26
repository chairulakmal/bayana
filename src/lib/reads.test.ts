// Characterization tests for the read-only aggregates: browse.ts, stats.ts and home.ts.
//
// One file for three modules because they are one behaviour seen three times — "count what
// this user has done at this level" — and the interesting cases are all about where the three
// deliberately *disagree*:
//
//   - `getHomeSnapshot.vocabDue` is NOT level-scoped, while everything beside it is.
//   - `getLevelStats.dueNow` IS level-scoped, and it sits on a page that says so.
//   - `cardsStudiedToday` counts distinct cards, not review events, so a bad vocab session
//     cannot inflate it past what grammar could ever report.
//
// Each of those looks like an inconsistency until you know why it is there, which is exactly
// what makes it likely to be "cleaned up" during a port. Hence a test for each, naming the
// reason.

import { describe, it, expect } from "vitest";
import { makeFakeDb, type Row } from "@/lib/__fixtures__/fake-db";
import { getLevelWords, getStartedWordIds } from "@/lib/browse";
import { getLevelStats } from "@/lib/stats";
import { getHomeSnapshot, pickNextAction, type HomeSnapshot } from "@/lib/home";
import { Level } from "@/generated/prisma/enums";

const USER = "user-1";
const NOW = new Date("2026-07-27T12:00:00Z");

function wordRow(id: string, expression: string, level: Level = Level.N5): Row {
  return { id, expression, reading: `よみ${id}`, meaning: `gloss ${id}`, level };
}

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

function logRow(id: string, wordId: string, reviewedAt: Date, rating: number): Row {
  return {
    id,
    userId: USER,
    wordId,
    rating,
    state: "REVIEW",
    due: reviewedAt,
    stability: 3.5,
    difficulty: 5.2,
    elapsedDays: 2,
    scheduledDays: 3,
    learningSteps: 0,
    reviewedAt,
  };
}

// ---------------------------------------------------------------------------
// browse.ts
// ---------------------------------------------------------------------------

describe("getLevelWords", () => {
  it("returns only the requested level", async () => {
    const fake = makeFakeDb({
      word: [wordRow("a", "あい", Level.N5), wordRow("b", "うえ", Level.N3)],
    });
    const words = await getLevelWords(Level.N5, fake.deps);
    expect(words.map((w) => w.id)).toEqual(["a"]);
  });

  it("returns only the four display fields, never the level or FSRS state", async () => {
    // The response this feeds is cached for a day precisely because it is identical for every
    // user. A per-user field creeping in here is what would silently make it uncacheable.
    const fake = makeFakeDb({ word: [wordRow("a", "あい")] });
    const [word] = await getLevelWords(Level.N5, fake.deps);
    expect(Object.keys(word).sort()).toEqual(["expression", "id", "meaning", "reading"]);
  });

  it("sorts by expression under Japanese collation", async () => {
    // The sort stays in JS rather than moving to SQL because `localeCompare(…, "ja")` orders
    // kana and kanji correctly and Postgres's own collation does not. Moving it into an
    // `ORDER BY` would silently change the order users see.
    const fake = makeFakeDb({
      word: [
        wordRow("c", "さくら"),
        wordRow("a", "あさ"),
        wordRow("b", "きって"),
      ],
    });
    const words = await getLevelWords(Level.N5, fake.deps);
    expect(words.map((w) => w.expression)).toEqual(["あさ", "きって", "さくら"]);
  });
});

describe("getStartedWordIds", () => {
  it("returns the ids of this user's started words at this level", async () => {
    const fake = makeFakeDb({
      word: [wordRow("a", "あ", Level.N5), wordRow("b", "い", Level.N5), wordRow("c", "う", Level.N3)],
      reviewState: [
        stateRow("a", NOW),
        stateRow("c", NOW), // right user, wrong level
        stateRow("b", NOW, { id: "rs-other", userId: "user-2" }), // right level, wrong user
      ],
    });
    expect(await getStartedWordIds(USER, Level.N5, fake.deps)).toEqual(["a"]);
  });

  it("counts a word as started from its first rating, whatever its state", async () => {
    // "Started" means a ReviewState row exists — not that the card has graduated. The magenta
    // dot on /browse and the hub's progress bar both read this, so a stricter definition would
    // make a word the user is actively learning look untouched.
    const fake = makeFakeDb({
      word: [wordRow("a", "あ")],
      reviewState: [stateRow("a", NOW, { state: "LEARNING", reps: 1 })],
    });
    expect(await getStartedWordIds(USER, Level.N5, fake.deps)).toEqual(["a"]);
  });

  it("returns [] rather than throwing for a user with no progress", async () => {
    const fake = makeFakeDb({ word: [wordRow("a", "あ")] });
    expect(await getStartedWordIds(USER, Level.N5, fake.deps)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// stats.ts
// ---------------------------------------------------------------------------

describe("getLevelStats", () => {
  function seeded() {
    return makeFakeDb({
      word: [
        wordRow("a", "あ", Level.N5),
        wordRow("b", "い", Level.N5),
        wordRow("c", "う", Level.N5),
        wordRow("z", "ん", Level.N3),
      ],
      reviewState: [
        stateRow("a", new Date(NOW.getTime() - 60_000), { state: "REVIEW" }), // due + mature
        stateRow("b", new Date(NOW.getTime() + 60_000), { state: "LEARNING" }), // started only
        stateRow("z", new Date(NOW.getTime() - 60_000), { state: "REVIEW" }), // other level
      ],
    });
  }

  it("scopes total, started, mature and dueNow to the level", async () => {
    const stats = await getLevelStats(USER, Level.N5, NOW, seeded().deps);
    expect(stats.total).toBe(3);
    expect(stats.started).toBe(2);
    expect(stats.mature).toBe(1); // "mature" = state REVIEW, i.e. graduated from learning
    expect(stats.dueNow).toBe(1);
  });

  it("reports recallRate null with no reviews in the window", async () => {
    // Null rather than 0: "no data" and "you got everything wrong" must not render the same.
    const stats = await getLevelStats(USER, Level.N5, NOW, seeded().deps);
    expect(stats.recallRate).toBeNull();
    expect(stats.recallSample).toBe(0);
  });

  it("counts a rating of 3 or 4 as recalled, and 1 or 2 as not", async () => {
    // **This test is why the source comment changed.** It used to describe `rating >= 2`
    // ("Hard/Good/Easy all mean you produced the answer") over code that says `>= 3`. The code
    // is the behaviour every displayed recall rate has ever been computed from, so the comment
    // was corrected to match rather than the threshold moved; which of the two is the better
    // proxy is left open in SPEC §15. This assertion is what keeps the two in step.
    const fake = makeFakeDb({
      word: [wordRow("a", "あ")],
      reviewState: [stateRow("a", NOW)],
      reviewLog: [
        logRow("l1", "a", new Date(NOW.getTime() - 86_400_000), 1), // Again
        logRow("l2", "a", new Date(NOW.getTime() - 86_400_000), 2), // Hard
        logRow("l3", "a", new Date(NOW.getTime() - 86_400_000), 3), // Good
        logRow("l4", "a", new Date(NOW.getTime() - 86_400_000), 4), // Easy
      ],
    });
    const stats = await getLevelStats(USER, Level.N5, NOW, fake.deps);
    expect(stats.recallSample).toBe(4);
    expect(stats.recallRate).toBe(0.5); // 2 of 4, not 3 of 4
  });

  it("ignores reviews older than the 30-day window", async () => {
    const fake = makeFakeDb({
      word: [wordRow("a", "あ")],
      reviewState: [stateRow("a", NOW)],
      reviewLog: [
        logRow("recent", "a", new Date(NOW.getTime() - 29 * 86_400_000), 3),
        logRow("stale", "a", new Date(NOW.getTime() - 31 * 86_400_000), 1),
      ],
    });
    const stats = await getLevelStats(USER, Level.N5, NOW, fake.deps);
    expect(stats.recallWindowDays).toBe(30);
    expect(stats.recallSample).toBe(1);
    expect(stats.recallRate).toBe(1);
  });

  it("scopes the recall rate to the level, in memory", async () => {
    // ReviewLog has no `word` relation, so this filter runs in JS against the level's word
    // ids. A port that reproduces the query but drops the in-memory filter would show a recall
    // rate blended across every level, and nothing would look broken.
    const fake = makeFakeDb({
      word: [wordRow("a", "あ", Level.N5), wordRow("z", "ん", Level.N3)],
      reviewState: [stateRow("a", NOW)],
      reviewLog: [
        logRow("l1", "a", new Date(NOW.getTime() - 86_400_000), 4), // in level
        logRow("l2", "z", new Date(NOW.getTime() - 86_400_000), 1), // other level
      ],
    });
    const stats = await getLevelStats(USER, Level.N5, NOW, fake.deps);
    expect(stats.recallSample).toBe(1);
    expect(stats.recallRate).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// home.ts
// ---------------------------------------------------------------------------

describe("getHomeSnapshot", () => {
  it("does NOT scope vocabDue to the level, while scoping progress to it", async () => {
    // The asymmetry the module header calls "honesty over tidiness". `getStudyQueue` serves
    // due cards regardless of level, so a Flashcards tile promising "1 due" when tapping it
    // serves 2 would be lying. The progress bar stays level-scoped because it is labelled
    // with the level.
    const fake = makeFakeDb({
      word: [wordRow("a", "あ", Level.N5), wordRow("z", "ん", Level.N3)],
      reviewState: [
        stateRow("a", new Date(NOW.getTime() - 60_000)),
        stateRow("z", new Date(NOW.getTime() - 60_000)),
      ],
    });

    const snap = await getHomeSnapshot(USER, Level.N5, NOW, fake.deps);

    expect(snap.vocabDue).toBe(2); // both levels
    expect(snap.vocabStarted).toBe(1); // N5 only
    expect(snap.vocabTotal).toBe(1); // N5 only
  });

  it("counts distinct cards studied today, not review events", async () => {
    // Rating a card "Again" writes several ReviewLog rows as it cycles through learning steps.
    // Counting rows would make a bad session look like a productive day, and would make the
    // vocab half of this number mean something different from the grammar half.
    const today = new Date(NOW);
    today.setHours(9, 0, 0, 0);
    const fake = makeFakeDb({
      word: [wordRow("a", "あ"), wordRow("b", "い")],
      reviewLog: [
        logRow("l1", "a", today, 1),
        logRow("l2", "a", today, 1), // same card again
        logRow("l3", "b", today, 3),
      ],
    });
    expect((await getHomeSnapshot(USER, Level.N5, NOW, fake.deps)).cardsStudiedToday).toBe(2);
  });

  it("excludes reviews from before today's local-server midnight", async () => {
    // A known limitation rather than a feature: the boundary is the *server's* midnight, so a
    // user in another timezone can watch this reset mid-session. `UserProfile.timezone` and
    // `dayStartHour` exist in the schema and are read by nothing (TODO.md). Pinned as-is so
    // the port carries the columns and can fix it deliberately.
    const today = new Date(NOW);
    today.setHours(9, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 86_400_000);
    const fake = makeFakeDb({
      word: [wordRow("a", "あ"), wordRow("b", "い")],
      reviewLog: [logRow("l1", "a", today, 3), logRow("l2", "b", yesterday, 3)],
    });
    expect((await getHomeSnapshot(USER, Level.N5, NOW, fake.deps)).cardsStudiedToday).toBe(1);
  });

  it("adds the grammar half of the day's count", async () => {
    // Note the mixed clocks, which is itself worth recording: `getHomeSnapshot` takes an
    // injectable `now` and passes it to the vocab counts, but `getGrammarStats` reads
    // `new Date()` internally and cannot be told otherwise. So the grammar due date here has
    // to be genuinely in the past rather than relative to `NOW`. Harmless today; it does mean
    // the grammar half of this snapshot is untestable at an arbitrary instant, and the port
    // should give that function the same injectable clock its two callers already have.
    const today = new Date(NOW);
    today.setHours(9, 0, 0, 0);
    const genuinelyDue = new Date("2020-01-01T00:00:00Z");
    const fake = makeFakeDb({
      word: [wordRow("a", "あ")],
      reviewLog: [logRow("l1", "a", today, 3)],
      grammarPoint: [{ id: "g1", level: "N5", lesson: 1, lessonTitle: "L", position: 1, pattern: "〜", reading: "〜", meanings: [], exampleJp: "", exampleEn: "" }],
      grammarProgress: [
        {
          id: "gp1",
          userId: USER,
          grammarPointId: "g1",
          due: genuinelyDue,
          stability: 1,
          difficulty: 1,
          elapsedDays: 0,
          scheduledDays: 1,
          learningSteps: 0,
          reps: 1,
          lapses: 0,
          state: "REVIEW",
          lastReview: today,
        },
      ],
    });

    const snap = await getHomeSnapshot(USER, Level.N5, NOW, fake.deps);

    expect(snap.grammarDue).toBe(1);
    expect(snap.grammarTotal).toBe(1);
    expect(snap.cardsStudiedToday).toBe(2); // 1 vocab card + 1 grammar point
  });

  it("reports zeros for a brand-new user rather than throwing", async () => {
    const fake = makeFakeDb({ word: [wordRow("a", "あ")] });
    expect(await getHomeSnapshot(USER, Level.N5, NOW, fake.deps)).toEqual({
      vocabDue: 0,
      vocabStarted: 0,
      vocabTotal: 1,
      grammarDue: 0,
      grammarStarted: 0,
      grammarTotal: 0,
      cardsStudiedToday: 0,
    });
  });
});

describe("pickNextAction", () => {
  function snapshot(over: Partial<HomeSnapshot> = {}): HomeSnapshot {
    return {
      vocabDue: 0,
      vocabStarted: 0,
      vocabTotal: 100,
      grammarDue: 0,
      grammarStarted: 0,
      grammarTotal: 0,
      cardsStudiedToday: 0,
      ...over,
    };
  }

  it("prioritises due vocab above everything else", async () => {
    // Overdue reviews are the only genuinely time-sensitive work in the app: every day they
    // slip, retention drops and the backlog compounds.
    const action = pickNextAction(snapshot({ vocabDue: 3, grammarDue: 9 }));
    expect(action.href).toBe("/study");
    expect(action.detail).toBe("3 cards ready");
  });

  it("falls to due grammar when no vocab is due", () => {
    const action = pickNextAction(snapshot({ grammarDue: 1 }));
    expect(action.href).toBe("/grammar/study");
    expect(action.detail).toBe("1 point ready"); // singular
  });

  it("offers new words when nothing is due but the level is unfinished", () => {
    expect(pickNextAction(snapshot({ vocabStarted: 10, vocabTotal: 100 })).label).toBe(
      "Learn new words",
    );
  });

  it("offers a quiz rather than a dead end when fully caught up", () => {
    // The hub never says "all done, go away".
    const action = pickNextAction(snapshot({ vocabStarted: 100, vocabTotal: 100 }));
    expect(action.href).toBe("/quiz");
  });

  it("pluralises the counts it renders", () => {
    expect(pickNextAction(snapshot({ vocabDue: 1 })).detail).toBe("1 card ready");
    expect(pickNextAction(snapshot({ vocabDue: 2 })).detail).toBe("2 cards ready");
    expect(pickNextAction(snapshot({ grammarDue: 2 })).detail).toBe("2 points ready");
  });
});
