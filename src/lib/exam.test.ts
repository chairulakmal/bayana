// Characterization tests for Exam mode's question builder (exam.ts).
//
// Same approach as `quiz.test.ts` — assert the guarantees, not a seeded sequence — with two
// additions specific to this mode:
//
//   1. **The section split is a contract, not an implementation detail.** `ExamSession` is
//      never told where 問題１ ends; it recovers the boundary from the question *order*, by
//      finding the first `type: "writing"`. So "ceil to reading, floor to writing, reading
//      first" is load-bearing behaviour and is tested as such.
//   2. **The okurigana constraint is what stops the exam being guessable.** Without it a
//      student eliminates options by pattern-matching the visible kana instead of knowing the
//      kanji, which is the difference between a benchmark and a puzzle.

import { describe, it, expect } from "vitest";
import { makeFakeDb, type Row } from "@/lib/__fixtures__/fake-db";
import {
  DEFAULT_EXAM_COUNT,
  buildExam,
  buildExamRound,
  pickReadingDistractors,
  pickWritingDistractors,
  type PoolWord,
} from "@/lib/exam";
import { Level } from "@/generated/prisma/enums";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function word(id: string, expression: string, reading: string, meaning: string): PoolWord {
  return { id, expression, reading, meaning };
}

/**
 * Every word here has kanji, because `buildExam` filters kana-only words out entirely: 問題１
 * ("read this kana") and 問題２ ("write the kanji") are both meaningless without one.
 *
 * The pool carries three -べる verbs so the okurigana constraint has candidates to satisfy,
 * and three 生 words so kanji overlap has something to score.
 */
const POOL: PoolWord[] = [
  word("v1", "食べる", "たべる", "to eat"),
  word("v2", "調べる", "しらべる", "to investigate"),
  word("v3", "比べる", "くらべる", "to compare"),
  word("n1", "学生", "がくせい", "student"),
  word("n2", "生活", "せいかつ", "daily life"),
  word("n3", "先生", "せんせい", "teacher"),
  word("n4", "新聞", "しんぶん", "newspaper"),
  word("n5", "電車", "でんしゃ", "train"),
  word("n6", "図書館", "としょかん", "library"),
  word("n7", "会社", "かいしゃ", "company"),
];

function wordRows(level: Level = Level.N5): Row[] {
  return POOL.map((w) => ({ ...w, level }));
}

/** A sentence row containing the word's exact expression, which writing targets require. */
function sentenceFor(w: PoolWord): Row {
  return {
    id: `s-${w.id}`,
    wordId: w.id,
    japanese: `これは${w.expression}です。`,
    reading: `これは${w.reading}です。`,
    english: `This is ${w.meaning}.`,
  };
}

// ---------------------------------------------------------------------------
// The section split — a contract with ExamSession
// ---------------------------------------------------------------------------

describe("buildExamRound section split", () => {
  const seeded = () => makeFakeDb({ word: wordRows(), exampleSentence: POOL.map(sentenceFor) });

  it("puts every reading question before every writing question", async () => {
    // ExamSession finds the section boundary by scanning for the first "writing", so an
    // interleaved round would put the break screen in the wrong place or never fire it.
    const questions = await buildExamRound(Level.N5, 8, seeded().deps);
    const firstWriting = questions.findIndex((q) => q.type === "writing");
    expect(firstWriting).toBeGreaterThan(0);
    expect(questions.slice(0, firstWriting).every((q) => q.type === "reading")).toBe(true);
    expect(questions.slice(firstWriting).every((q) => q.type === "writing")).toBe(true);
  });

  it("splits an even count in half", async () => {
    const questions = await buildExamRound(Level.N5, 8, seeded().deps);
    expect(questions.filter((q) => q.type === "reading")).toHaveLength(4);
    expect(questions.filter((q) => q.type === "writing")).toHaveLength(4);
  });

  it("gives the spare question to 問題１ on an odd count", async () => {
    // Ceil to reading, floor to writing. Reading is the section with no sentence-substitution
    // constraint, so it is the one that can always be filled.
    const questions = await buildExamRound(Level.N5, 7, seeded().deps);
    expect(questions.filter((q) => q.type === "reading")).toHaveLength(4);
    expect(questions.filter((q) => q.type === "writing")).toHaveLength(3);
  });

  it("defaults to DEFAULT_EXAM_COUNT and clamps to [2, 40]", async () => {
    // A 10-word pool cannot fill 20 questions, so this asserts the *requested* split rather
    // than the delivered length: the clamp is what is under test.
    expect(DEFAULT_EXAM_COUNT).toBe(20);
    const big = makeFakeDb({
      word: Array.from({ length: 60 }, (_, i) => ({
        id: `k${i}`,
        expression: `語${i}`,
        reading: `ご${i}`,
        meaning: `gloss ${i}`,
        level: Level.N5,
      })),
    });
    expect(await buildExamRound(Level.N5, undefined, big.deps)).toHaveLength(20);
    expect(await buildExamRound(Level.N5, 999, big.deps)).toHaveLength(40);
    expect(await buildExamRound(Level.N5, 0, big.deps)).toHaveLength(2); // floor is 2, not 1
    expect(await buildExamRound(Level.N5, NaN, big.deps)).toHaveLength(20);
  });
});

// ---------------------------------------------------------------------------
// Question shape
// ---------------------------------------------------------------------------

describe("buildExam question shape", () => {
  const seeded = () => makeFakeDb({ word: wordRows(), exampleSentence: POOL.map(sentenceFor) });

  it("gives every question 4 options with exactly one correct", async () => {
    const questions = await buildExam(Level.N5, 3, 3, seeded().deps);
    for (const q of questions) {
      expect(q.options).toHaveLength(4);
      expect(q.options.filter((o) => o.correct)).toHaveLength(1);
    }
  });

  it("offers readings in 問題１ and kanji forms in 問題２", async () => {
    const questions = await buildExam(Level.N5, 3, 3, seeded().deps);
    const readings = new Set(POOL.map((w) => w.reading));
    const expressions = new Set(POOL.map((w) => w.expression));
    for (const q of questions) {
      const bucket = q.type === "reading" ? readings : expressions;
      for (const option of q.options) expect(bucket).toContain(option.text);
    }
  });

  it("never uses the same word as a target twice in one round", async () => {
    const questions = await buildExam(Level.N5, 4, 4, seeded().deps);
    expect(new Set(questions.map((q) => q.wordId)).size).toBe(questions.length);
  });

  it("substitutes the kana reading into a writing question's sentence", async () => {
    // This is what makes 問題２ answerable: the student sees the word in kana context and has
    // to identify which kanji form it is. If the substitution silently failed, the sentence
    // would show the answer.
    const questions = await buildExam(Level.N5, 0, 4, seeded().deps);
    for (const q of questions) {
      expect(q.type).toBe("writing");
      const target = POOL.find((w) => w.id === q.wordId)!;
      expect(q.sentence).toContain(target.reading);
      expect(q.sentence).not.toContain(target.expression);
      expect(q.target).toBe(target.reading); // the span the UI underlines
    }
  });

  it("leaves a reading question's sentence untouched", async () => {
    const questions = await buildExam(Level.N5, 4, 0, seeded().deps);
    for (const q of questions) {
      const target = POOL.find((w) => w.id === q.wordId)!;
      expect(q.sentence).toContain(target.expression);
      expect(q.target).toBe(target.expression);
    }
  });

  it("falls back to the bare word when a target has no cached sentence", async () => {
    const fake = makeFakeDb({ word: wordRows() }); // no ExampleSentence rows at all
    const questions = await buildExam(Level.N5, 4, 0, fake.deps);
    for (const q of questions) {
      const target = POOL.find((w) => w.id === q.wordId)!;
      expect(q.sentence).toBe(target.expression);
      expect(q.sentenceReading).toBeNull();
      expect(q.sentenceEnglish).toBeNull();
    }
  });

  it("returns [] when the level has too few words, or too few with kanji", async () => {
    expect(await buildExam(Level.N5, 2, 2, makeFakeDb({ word: wordRows().slice(0, 3) }).deps)).toEqual([]);

    // Enough words, but all kana: unsuitable for both question types.
    const kanaOnly = makeFakeDb({
      word: [
        { id: "a", expression: "たべる", reading: "たべる", meaning: "to eat", level: Level.N5 },
        { id: "b", expression: "のむ", reading: "のむ", meaning: "to drink", level: Level.N5 },
        { id: "c", expression: "みる", reading: "みる", meaning: "to see", level: Level.N5 },
        { id: "d", expression: "テレビ", reading: "てれび", meaning: "television", level: Level.N5 },
      ],
    });
    expect(await buildExam(Level.N5, 2, 2, kanaOnly.deps)).toEqual([]);
  });

  it("draws options only from the requested level", async () => {
    const fake = makeFakeDb({
      word: [
        ...wordRows(Level.N5),
        { id: "x1", expression: "憂鬱", reading: "ゆううつ", meaning: "melancholy", level: Level.N1 },
      ],
    });
    const questions = await buildExam(Level.N5, 4, 2, fake.deps);
    for (const q of questions) {
      for (const option of q.options) {
        expect(option.text).not.toBe("憂鬱");
        expect(option.text).not.toBe("ゆううつ");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Distractor selection
// ---------------------------------------------------------------------------

describe("pickReadingDistractors", () => {
  const target = POOL[0]; // 食べる / たべる, okurigana べる

  it("returns n distractors, never the target", () => {
    for (let i = 0; i < 30; i++) {
      const picked = pickReadingDistractors(target, POOL, 3);
      expect(picked).toHaveLength(3);
      expect(picked.map((p) => p.id)).not.toContain(target.id);
    }
  });

  it("never offers two options that sound identical", () => {
    // Deduped by `reading`: two identical kana options would make the question unanswerable.
    const pool = [...POOL, word("hom", "食べる", "たべる", "to eat (alt)")];
    for (let i = 0; i < 30; i++) {
      const readings = pickReadingDistractors(target, pool, 3).map((p) => p.reading);
      expect(new Set(readings).size).toBe(readings.length);
      expect(readings).not.toContain(target.reading); // would be a second correct answer
    }
  });

  it("prefers readings ending in the target's okurigana when the pool allows it", () => {
    // 食べる ends in べる, so しらべる and くらべる are the fair distractors: without this
    // constraint the student reads the visible べる and eliminates がくせい in one glance.
    const okuriPool = [POOL[0], POOL[1], POOL[2], POOL[3], POOL[4], POOL[5]];
    for (let i = 0; i < 30; i++) {
      const picked = pickReadingDistractors(target, okuriPool, 2);
      expect(picked.every((p) => p.reading.endsWith("べる"))).toBe(true);
    }
  });

  it("relaxes the okurigana constraint rather than returning short", () => {
    // Only one other -べる word exists here, so slot three has to come from outside the
    // constrained set. A full question still builds; that fallback is deliberate.
    const thin = [POOL[0], POOL[1], POOL[3], POOL[4], POOL[5]];
    expect(pickReadingDistractors(target, thin, 3)).toHaveLength(3);
  });
});

describe("pickWritingDistractors", () => {
  const target = POOL[0]; // 食べる

  it("returns n distractors, never the target and never a duplicate spelling", () => {
    for (let i = 0; i < 30; i++) {
      const picked = pickWritingDistractors(target, POOL, 3);
      expect(picked).toHaveLength(3);
      const expressions = picked.map((p) => p.expression);
      expect(expressions).not.toContain(target.expression);
      expect(new Set(expressions).size).toBe(expressions.length);
    }
  });

  it("prefers expressions ending in the target's okurigana when the pool allows it", () => {
    // The mirror of the reading constraint: the sentence shows たべる, so an option whose
    // okurigana cannot produce that ending is eliminable without knowing any kanji.
    const okuriPool = [POOL[0], POOL[1], POOL[2], POOL[3], POOL[4], POOL[5]];
    for (let i = 0; i < 30; i++) {
      const picked = pickWritingDistractors(target, okuriPool, 2);
      expect(picked.every((p) => p.expression.endsWith("べる"))).toBe(true);
    }
  });

  it("weights phonetic similarity ahead of kanji overlap", () => {
    // The documented asymmetry between the two sections: 問題２ shows kana, so a same-sounding
    // word is the plausible mix-up. 効く/きく must beat 生活/せいかつ against 聞く/きく even
    // though neither shares a kanji with it.
    const kiku = word("t", "聞く", "きく", "to listen");
    const pool = [
      kiku,
      word("hom", "効く", "きく", "to be effective"),
      word("far", "生活", "せいかつ", "daily life"),
      word("far2", "図書館", "としょかん", "library"),
      word("far3", "電車", "でんしゃ", "train"),
    ];
    let homophonePicks = 0;
    for (let i = 0; i < 100; i++) {
      if (pickWritingDistractors(kiku, pool, 1).some((p) => p.id === "hom")) homophonePicks++;
    }
    expect(homophonePicks).toBeGreaterThan(50);
  });
});
