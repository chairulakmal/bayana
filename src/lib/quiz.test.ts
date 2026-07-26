// Characterization tests for Quiz mode's question builder (quiz.ts).
//
// **What these assert, and why that shape.** `pickDistractors` and `buildQuiz` both shuffle,
// so there is no fixed output to compare against. Asserting on a frozen sequence would mean
// seeding the generator, which pins an implementation detail the Nuxt port is free to change.
// So these test the *guarantees* instead — "four options, exactly one correct, all meanings
// distinct, distractors drawn from the same level" — which is the form TODO.md asks for: a
// statement that survives a schema redesign and becomes its specification.
//
// Where randomness could hide a bug (a guard that only usually fires), the assertion runs over
// many rounds rather than one.

import { describe, it, expect } from "vitest";
import { makeFakeDb, type Row } from "@/lib/__fixtures__/fake-db";
import {
  DEFAULT_QUIZ_COUNT,
  buildQuiz,
  buildQuizRound,
  meaningTokens,
  meaningTooClose,
  normalizeMeaning,
  pickDistractors,
  type PoolWord,
} from "@/lib/quiz";
import { Level } from "@/generated/prisma/enums";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function word(id: string, expression: string, reading: string, meaning: string): PoolWord {
  return { id, expression, reading, meaning };
}

/**
 * A pool with a deliberate shape: 生 is shared by three words, so the confusability
 * shortlist has something to find, and the rest are unrelated filler.
 */
const POOL: PoolWord[] = [
  word("w1", "学生", "がくせい", "student"),
  word("w2", "生活", "せいかつ", "daily life"),
  word("w3", "先生", "せんせい", "teacher"),
  word("w4", "食べる", "たべる", "to eat"),
  word("w5", "飲む", "のむ", "to drink"),
  word("w6", "新聞", "しんぶん", "newspaper"),
  word("w7", "電車", "でんしゃ", "train"),
  word("w8", "図書館", "としょかん", "library"),
];

/** The same pool as `Word` rows for the fake database, all at one level. */
function wordRows(level: Level = Level.N5): Row[] {
  return POOL.map((w) => ({ ...w, level }));
}

// ---------------------------------------------------------------------------
// pickDistractors — the guarantees the module documents
// ---------------------------------------------------------------------------

describe("pickDistractors", () => {
  const target = POOL[0]; // 学生 / student

  it("returns exactly n distractors when the pool allows it", () => {
    expect(pickDistractors(target, POOL, 3)).toHaveLength(3);
  });

  it("never returns the target itself", () => {
    for (let i = 0; i < 50; i++) {
      expect(pickDistractors(target, POOL, 3).map((d) => d.id)).not.toContain(target.id);
    }
  });

  it("never returns two distractors with the same meaning", () => {
    // The pool carries a case-differing duplicate so the dedupe has to be
    // case-insensitive, not just an identity check.
    const pool = [...POOL, word("dup", "生徒", "せいと", "Student")];
    for (let i = 0; i < 50; i++) {
      const meanings = pickDistractors(target, pool, 3).map((d) => normalizeMeaning(d.meaning));
      expect(new Set(meanings).size).toBe(meanings.length);
    }
  });

  it("never returns a distractor whose meaning matches the target's", () => {
    // "Student" would be a second correct answer. This is the guard that keeps the quiz fair
    // rather than merely hard.
    const pool = [...POOL, word("dup", "生徒", "せいと", "Student")];
    for (let i = 0; i < 50; i++) {
      const meanings = pickDistractors(target, pool, 3).map((d) => normalizeMeaning(d.meaning));
      expect(meanings).not.toContain("student");
    }
  });

  it("rejects a near-synonym that shares most of its content words", () => {
    // "to look" vs "to look up" — the documented example. Both would be arguably correct.
    const lookTarget = word("t", "見る", "みる", "to look");
    const pool = [lookTarget, word("n", "調べる", "しらべる", "to look up"), ...POOL];
    for (let i = 0; i < 50; i++) {
      const ids = pickDistractors(lookTarget, pool, 3).map((d) => d.id);
      expect(ids).not.toContain("n");
    }
  });

  it("prefers confusable candidates over unrelated ones", () => {
    // Not "always picks 生" — the shortlist is randomised on purpose (variety), and the
    // fallback fills from the whole pool. The claim that IS true is statistical: across many
    // rounds a kanji-sharing word must appear more often than an unrelated one.
    let sharedKanjiPicks = 0;
    let unrelatedPicks = 0;
    for (let i = 0; i < 200; i++) {
      for (const d of pickDistractors(target, POOL, 3)) {
        if (d.id === "w2" || d.id === "w3") sharedKanjiPicks++; // 生活, 先生 share 生
        if (d.id === "w7" || d.id === "w8") unrelatedPicks++; // 電車, 図書館 share nothing
      }
    }
    expect(sharedKanjiPicks).toBeGreaterThan(unrelatedPicks);
  });

  it("falls back rather than returning short when confusable candidates run out", () => {
    // Three words with nothing in common: every score is 0, so the shortlist is empty and
    // only the random fallback can fill the slots. A full question must still build.
    const lonely = word("t", "犬", "いぬ", "dog");
    const pool = [lonely, word("a", "机", "つくえ", "desk"), word("b", "空", "そら", "sky"), word("c", "海", "うみ", "sea")];
    expect(pickDistractors(lonely, pool, 3)).toHaveLength(3);
  });

  it("returns fewer than n when the pool genuinely cannot supply them", () => {
    // Documented behaviour rather than a throw. `buildQuiz` guards the pool size up front,
    // so this only describes what the helper does in isolation.
    const lonely = word("t", "犬", "いぬ", "dog");
    expect(pickDistractors(lonely, [lonely, word("a", "机", "つくえ", "desk")], 3)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Meaning helpers
// ---------------------------------------------------------------------------

describe("meaningTokens", () => {
  it("lowercases, drops parentheticals, and strips stopwords", () => {
    expect([...meaningTokens("To Eat (a meal)")]).toEqual(["eat"]);
  });

  it("splits on punctuation rather than treating it as part of a word", () => {
    expect(meaningTokens("newspaper; press/media")).toEqual(
      new Set(["newspaper", "press", "media"]),
    );
  });

  it("can return an empty set for an all-stopword gloss", () => {
    // This is why `meaningTooClose` returns false on an empty side: with no content words
    // there is nothing to compare, and treating that as "identical" would reject everything.
    expect(meaningTokens("to be").size).toBe(0);
  });
});

describe("meaningTooClose", () => {
  it("is true when the glosses share at least half their content words", () => {
    expect(meaningTooClose(meaningTokens("to look"), meaningTokens("to look up"))).toBe(true);
  });

  it("is false for unrelated glosses", () => {
    expect(meaningTooClose(meaningTokens("student"), meaningTokens("newspaper"))).toBe(false);
  });

  it("is false when either side has no content words", () => {
    expect(meaningTooClose(meaningTokens("to be"), meaningTokens("student"))).toBe(false);
  });

  it("does NOT catch pure synonyms — an accepted limit, pinned here on purpose", () => {
    // "big" and "large" share no token, so the guard cannot see them. Catching this would
    // need embeddings; the limitation is documented in the source and asserted here so that
    // if it ever changes, it changes deliberately.
    expect(meaningTooClose(meaningTokens("big"), meaningTokens("large"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildQuiz / buildQuizRound — the round the session actually renders
// ---------------------------------------------------------------------------

describe("buildQuiz", () => {
  it("builds `count` questions, each with 4 options and exactly one correct", () => {
    const fake = makeFakeDb({ word: wordRows() });
    return buildQuiz(Level.N5, 5, fake.deps).then((questions) => {
      expect(questions).toHaveLength(5);
      for (const q of questions) {
        expect(q.options).toHaveLength(4);
        expect(q.options.filter((o) => o.correct)).toHaveLength(1);
      }
    });
  });

  it("draws every option's meaning from the same level", async () => {
    // The scoping claim: a question at N5 must never show an N1 gloss as a distractor.
    const fake = makeFakeDb({
      word: [
        ...wordRows(Level.N5),
        { id: "x1", expression: "憂鬱", reading: "ゆううつ", meaning: "melancholy", level: Level.N1 },
        { id: "x2", expression: "曖昧", reading: "あいまい", meaning: "ambiguous", level: Level.N1 },
      ],
    });
    const questions = await buildQuiz(Level.N5, 8, fake.deps);
    const levelMeanings = new Set(POOL.map((w) => w.meaning));
    for (const q of questions) {
      for (const option of q.options) {
        expect(levelMeanings).toContain(option.meaning);
      }
    }
  });

  it("never repeats a target word within a round", async () => {
    const fake = makeFakeDb({ word: wordRows() });
    const questions = await buildQuiz(Level.N5, 8, fake.deps);
    expect(new Set(questions.map((q) => q.wordId)).size).toBe(questions.length);
  });

  it("attaches a cached sentence when one exists and null when it does not", async () => {
    const fake = makeFakeDb({
      word: wordRows(),
      exampleSentence: [
        { id: "s1", wordId: "w1", japanese: "私は学生です。", reading: "わたしはがくせいです。", english: "I am a student." },
      ],
    });
    const questions = await buildQuiz(Level.N5, 8, fake.deps);
    const withSentence = questions.find((q) => q.wordId === "w1");
    expect(withSentence?.sentence).toEqual({
      japanese: "私は学生です。",
      reading: "わたしはがくせいです。",
      english: "I am a student.",
    });
    expect(questions.find((q) => q.wordId === "w5")?.sentence).toBeNull();
  });

  it("caps the round at the pool size rather than repeating words", async () => {
    const fake = makeFakeDb({ word: wordRows() });
    expect(await buildQuiz(Level.N5, 50, fake.deps)).toHaveLength(POOL.length);
  });

  it("returns [] when the level has fewer words than a question needs", async () => {
    // Fewer than 4 words cannot fill one question's options, so the mode reports "no quiz
    // available" as a state rather than throwing.
    const fake = makeFakeDb({
      word: wordRows().slice(0, 3),
    });
    expect(await buildQuiz(Level.N5, 5, fake.deps)).toEqual([]);
  });
});

describe("buildQuizRound", () => {
  it("defaults to DEFAULT_QUIZ_COUNT questions", async () => {
    const fake = makeFakeDb({
      word: Array.from({ length: 30 }, (_, i) => ({
        id: `g${i}`,
        expression: `語${i}`,
        reading: `ご${i}`,
        meaning: `gloss ${i}`,
        level: Level.N5,
      })),
    });
    expect(await buildQuizRound(Level.N5, undefined, fake.deps)).toHaveLength(DEFAULT_QUIZ_COUNT);
    expect(DEFAULT_QUIZ_COUNT).toBe(10);
  });

  it("clamps the count to [1, 20], including for junk input", async () => {
    const fake = makeFakeDb({
      word: Array.from({ length: 40 }, (_, i) => ({
        id: `g${i}`,
        expression: `語${i}`,
        reading: `ご${i}`,
        meaning: `gloss ${i}`,
        level: Level.N5,
      })),
    });
    // The clamp lives in the builder rather than in either route handler, so no caller can
    // ask for an unbounded round whether or not it remembered to validate first.
    expect(await buildQuizRound(Level.N5, 999, fake.deps)).toHaveLength(20);
    expect(await buildQuizRound(Level.N5, 0, fake.deps)).toHaveLength(1);
    expect(await buildQuizRound(Level.N5, -5, fake.deps)).toHaveLength(1);
    expect(await buildQuizRound(Level.N5, 3.9, fake.deps)).toHaveLength(3); // truncated, not rounded
    expect(await buildQuizRound(Level.N5, NaN, fake.deps)).toHaveLength(DEFAULT_QUIZ_COUNT);
  });
});
