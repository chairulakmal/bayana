// Characterization tests for the shared scoring toolkit (word-similarity.ts).
//
// These are the cheapest and most valuable tests in the suite: the functions are pure, they
// have no database, and they are the *inputs* to every distractor decision both question
// modes make. A drift here does not fail loudly — it makes quizzes quietly easier — which is
// exactly the failure mode TODO.md's characterization item names.
//
// The examples are real Japanese, not `"a"`/`"b"` placeholders, because the interesting cases
// are all script-dependent: what counts as a kanji, where okurigana starts, whether two
// readings are near-misses. A test written on Latin letters would pass while saying nothing
// about the data this code actually sees.

import { describe, it, expect } from "vitest";
import {
  isHiragana,
  isKanji,
  jaccard,
  kanjiOf,
  levenshtein,
  okurigana,
  readingSimilarity,
  sample,
  shuffle,
} from "@/lib/word-similarity";

describe("kanjiOf", () => {
  it("extracts the distinct kanji and ignores kana", () => {
    expect([...kanjiOf("食べる")]).toEqual(["食"]);
    expect([...kanjiOf("学生")]).toEqual(["学", "生"]);
  });

  it("returns an empty set for kana-only words", () => {
    // The case the whole scoring model rests on: a kana-only word shares no kanji with
    // anything, so it must fall through to reading similarity alone.
    expect(kanjiOf("たべる").size).toBe(0);
    expect(kanjiOf("テレビ").size).toBe(0);
  });

  it("de-duplicates a repeated kanji", () => {
    // 人々 has two characters but one kanji plus an iteration mark, and 生生 would be one
    // distinct kanji. Jaccard is defined over *sets*, so this is load-bearing.
    expect(kanjiOf("学学").size).toBe(1);
  });
});

describe("isHiragana / isKanji", () => {
  it("classifies the three scripts the deck uses", () => {
    expect(isHiragana("あ")).toBe(true);
    expect(isHiragana("ア")).toBe(false); // katakana is not hiragana
    expect(isHiragana("食")).toBe(false);
    expect(isKanji("食")).toBe(true);
    expect(isKanji("あ")).toBe(false);
  });
});

describe("okurigana", () => {
  it("returns the hiragana tail after the final kanji", () => {
    expect(okurigana("主に")).toBe("に");
    expect(okurigana("食べる")).toBe("べる");
    expect(okurigana("聞こえる")).toBe("こえる");
  });

  it("returns empty for a pure-kanji word", () => {
    expect(okurigana("学校")).toBe("");
  });

  it("returns empty for a pure-kana word", () => {
    // Not an oversight: for a kana-only word the visible kana IS the whole word, so
    // constraining distractors on it would eliminate everything.
    expect(okurigana("たべる")).toBe("");
    expect(okurigana("テレビ")).toBe("");
  });

  it("returns empty when the trailing kana follows katakana rather than kanji", () => {
    expect(okurigana("テレビの")).toBe("");
  });
});

describe("jaccard", () => {
  it("is 1 for identical non-empty sets and 0 for disjoint ones", () => {
    expect(jaccard(new Set(["生"]), new Set(["生"]))).toBe(1);
    expect(jaccard(new Set(["生"]), new Set(["学"]))).toBe(0);
  });

  it("is |A∩B| / |A∪B| for a partial overlap", () => {
    // 学生 vs 生活 share 生: intersection 1, union 3.
    expect(jaccard(kanjiOf("学生"), kanjiOf("生活"))).toBeCloseTo(1 / 3);
  });

  it("is 0 when either set is empty, including when both are", () => {
    // Documented choice, not a mathematical one — see the function's doc comment. Two
    // kana-only words must not score as a perfect match against each other.
    expect(jaccard(new Set(), new Set())).toBe(0);
    expect(jaccard(kanjiOf("たべる"), kanjiOf("のむ"))).toBe(0);
  });
});

describe("levenshtein", () => {
  it("is 0 for identical strings and the length for an empty comparison", () => {
    expect(levenshtein("きく", "きく")).toBe(0);
    expect(levenshtein("", "きく")).toBe(2);
    expect(levenshtein("きく", "")).toBe(2);
  });

  it("counts substitutions, insertions and deletions", () => {
    expect(levenshtein("きく", "かく")).toBe(1); // substitute
    expect(levenshtein("きく", "きくう")).toBe(1); // insert
    expect(levenshtein("たべる", "たべ")).toBe(1); // delete
  });

  it("is symmetric", () => {
    expect(levenshtein("しんぶん", "しんぱい")).toBe(levenshtein("しんぱい", "しんぶん"));
  });
});

describe("readingSimilarity", () => {
  it("is 1 for identical readings", () => {
    // The homophone case Exam mode's 問題２ is built around: 聞く and 効く are both きく.
    expect(readingSimilarity("きく", "きく")).toBe(1);
  });

  it("scores a near-miss above an unrelated reading", () => {
    const near = readingSimilarity("しんぶん", "しんぱい"); // 2 of 4 differ
    const far = readingSimilarity("しんぶん", "たべる");
    expect(near).toBeGreaterThan(far);
    expect(near).toBeCloseTo(0.5);
  });

  it("is 0 when both readings are empty", () => {
    expect(readingSimilarity("", "")).toBe(0);
  });

  it("stays within [0, 1]", () => {
    const pairs: [string, string][] = [
      ["きく", "きく"],
      ["しんぶん", "たべる"],
      ["", "ながい"],
      ["あ", "あいうえお"],
    ];
    for (const [a, b] of pairs) {
      const s = readingSimilarity(a, b);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});

describe("shuffle / sample", () => {
  it("shuffle keeps every element and leaves the input untouched", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input);
    expect(out).not.toBe(input); // a new array, per the contract
    expect(input).toEqual([1, 2, 3, 4, 5]); // caller's array unmodified
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]); // a permutation, nothing lost
  });

  it("sample returns n distinct elements, or all of them when n is larger", () => {
    const input = ["a", "b", "c", "d"];
    expect(sample(input, 2)).toHaveLength(2);
    expect(new Set(sample(input, 3)).size).toBe(3);
    expect([...sample(input, 99)].sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("actually permutes, given enough attempts", () => {
    // A `shuffle` that returned its input unchanged would satisfy every assertion above.
    // With 8 elements the chance of 40 consecutive identity permutations is ~1 in 40320^40,
    // so this is deterministic in practice without seeding the generator.
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const sawADifferentOrder = Array.from({ length: 40 }, () => shuffle(input)).some(
      (out) => out.join() !== input.join(),
    );
    expect(sawADifferentOrder).toBe(true);
  });
});
