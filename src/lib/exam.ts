// Exam mode question builder (SPEC §8.6).
//
// Builds a JLPT-style exam round in two sections:
//
//   問題１ (reading) — show the word's kanji in a sentence, pick its kana reading.
//   問題２ (writing) — show the word's kana in a sentence, pick its kanji form.
//
// Both sections are drawn from random same-level words, completely independent of FSRS
// state. Exam mode is a pure benchmark — it doesn't write to or read from ReviewState
// (SPEC §8.6: modes are independent by design). FSRS coupling is a deliberate non-goal
// for this mode; see SPEC §16 for the decision.
//
// Distractor strategy differs by question type:
//   問題１ — distractors are readings of kanji/phonetically confusable words (same
//            signals as Quiz mode's expression distractors, applied to the reading field).
//   問題２ — distractors are expressions of words whose readings sound similar to the
//            target (reading similarity is the primary signal; shared kanji are a bonus).
//
// Utility functions (kanjiOf, jaccard, readingSimilarity, levenshtein, shuffle, sample)
// are duplicated from quiz.ts to keep both modules self-contained. A shared util is the
// natural next step if a third consumer appears.

import { db } from "@/lib/db";
import type { Level } from "@/generated/prisma/enums";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ExamOption = { text: string; correct: boolean };

/**
 * 問題１: show a sentence with a kanji word; pick the correct kana reading.
 *   `sentence`        — the original Japanese sentence from ExampleSentence.
 *   `sentenceReading` — kana reading of the full sentence, revealed after answering.
 *   `sentenceEnglish` — English translation, revealed after answering.
 *   `target`          — the kanji expression to underline in the sentence.
 *   `options`         — 4 kana strings (exactly one `correct`).
 */
export type ReadingQuestion = {
  type: "reading";
  wordId: string;
  sentence: string;
  sentenceReading: string | null;
  sentenceEnglish: string | null;
  target: string;
  meaning: string;
  options: ExamOption[];
};

/**
 * 問題２: show a sentence with the word replaced by its kana reading; pick the correct
 * kanji form.
 *   `sentence`        — the sentence with the kanji expression replaced by the kana reading.
 *   `sentenceReading` — kana reading of the full sentence (also with kana substituted in).
 *   `sentenceEnglish` — English translation, revealed after answering.
 *   `target`          — the kana reading to underline in the (already-substituted) sentence.
 *   `options`         — 4 kanji expression strings (exactly one `correct`).
 */
export type WritingQuestion = {
  type: "writing";
  wordId: string;
  sentence: string;
  sentenceReading: string | null;
  sentenceEnglish: string | null;
  target: string;
  meaning: string;
  options: ExamOption[];
};

export type ExamQuestion = ReadingQuestion | WritingQuestion;

// ---------------------------------------------------------------------------
// Public builder
// ---------------------------------------------------------------------------

const OPTIONS_PER_QUESTION = 4;

type PoolWord = { id: string; expression: string; reading: string; meaning: string };

type SentenceRow = { wordId: string; japanese: string; reading: string; english: string };

/**
 * Build an exam round for `level`. Returns `readingCount` 問題１ questions followed by
 * `writingCount` 問題２ questions. Returns `[]` if the pool is too small.
 *
 * Targets are sampled without replacement across both sections so the same word cannot
 * appear as both a 問題１ and 問題２ target in the same round.
 */
export async function buildExam(
  level: Level,
  readingCount: number,
  writingCount: number,
): Promise<ExamQuestion[]> {
  const pool: PoolWord[] = await db.word.findMany({
    where: { level },
    select: { id: true, expression: true, reading: true, meaning: true },
  });

  // Need at least OPTIONS_PER_QUESTION words to form any question.
  if (pool.length < OPTIONS_PER_QUESTION) return [];

  // Filter to words with kanji. Pure-kana words (e.g. たべる, テレビ) are unsuitable for
  // both question types: 問題１ asks "read this kana?" (trivially obvious) and 問題２ asks
  // "write the kanji?" when there is no kanji form.
  const kanjiWords = pool.filter((w) => kanjiOf(w.expression).size > 0);
  if (kanjiWords.length < OPTIONS_PER_QUESTION) return [];

  // Oversample candidates so we have enough after filtering writing targets below.
  // Writing questions require the sentence to contain the exact expression, otherwise the
  // kana substitution fails and the question renders without an underlined word.
  const WRITING_OVERSAMPLE = 3;
  const candidateCount = readingCount + writingCount * WRITING_OVERSAMPLE;
  const candidates = sample(kanjiWords, Math.min(candidateCount, kanjiWords.length));

  // Fetch sentences for all candidates in one query (reading + english for the reveal panel).
  const sentenceRows = await db.exampleSentence.findMany({
    where: { wordId: { in: candidates.map((c) => c.id) } },
    select: { wordId: true, japanese: true, reading: true, english: true },
  });
  const sentenceByWord = new Map<string, SentenceRow>(sentenceRows.map((s) => [s.wordId, s]));

  // Reading targets: first readingCount candidates — no sentence constraint needed because
  // HighlightedSentence handles conjugated forms via progressive prefix matching.
  const readingTargets = candidates.slice(0, readingCount);
  const usedIds = new Set(readingTargets.map((w) => w.id));

  // Writing targets: must have a sentence containing the exact expression, so the kana
  // substitution (食べる → たべる) succeeds and the underlined word is unambiguous.
  const writingTargets: PoolWord[] = [];
  for (const w of candidates.slice(readingCount)) {
    if (writingTargets.length >= writingCount) break;
    if (usedIds.has(w.id)) continue;
    const s = sentenceByWord.get(w.id);
    if (!s?.japanese.includes(w.expression)) continue; // skip: substitution would fail
    writingTargets.push(w);
    usedIds.add(w.id);
  }
  // Fallback: if oversampling still wasn't enough, accept remaining candidates without the
  // substitution constraint (renders without underline — rare, silently accepted).
  if (writingTargets.length < writingCount) {
    for (const w of candidates.slice(readingCount)) {
      if (writingTargets.length >= writingCount) break;
      if (usedIds.has(w.id)) continue;
      writingTargets.push(w);
      usedIds.add(w.id);
    }
  }

  // --- 問題１: reading questions -------------------------------------------
  const readingQs: ReadingQuestion[] = readingTargets.map((target) => {
    const s = sentenceByWord.get(target.id);
    const distractors = pickReadingDistractors(target, pool, OPTIONS_PER_QUESTION - 1);
    return {
      type: "reading",
      wordId: target.id,
      sentence: s?.japanese ?? target.expression,
      sentenceReading: s?.reading ?? null,
      sentenceEnglish: s?.english ?? null,
      target: target.expression,
      meaning: target.meaning,
      options: shuffle<ExamOption>([
        { text: target.reading, correct: true },
        ...distractors.map((d) => ({ text: d.reading, correct: false })),
      ]),
    };
  });

  // --- 問題２: writing questions -------------------------------------------
  const writingQs: WritingQuestion[] = writingTargets.map((target) => {
    const s = sentenceByWord.get(target.id);
    const rawSentence = s?.japanese ?? target.reading;
    // Substitute the kanji expression with kana so the student sees the word in kana
    // context and must identify the correct kanji form. Writing targets were pre-filtered
    // to guarantee this replace succeeds.
    const sentence = rawSentence.replace(target.expression, target.reading);
    const distractors = pickWritingDistractors(target, pool, OPTIONS_PER_QUESTION - 1);
    return {
      type: "writing",
      wordId: target.id,
      sentence,
      // sentenceReading is already full kana — no substitution needed.
      sentenceReading: s?.reading ?? null,
      sentenceEnglish: s?.english ?? null,
      target: target.reading,
      meaning: target.meaning,
      options: shuffle<ExamOption>([
        { text: target.expression, correct: true },
        ...distractors.map((d) => ({ text: d.expression, correct: false })),
      ]),
    };
  });

  return [...readingQs, ...writingQs];
}

// ---------------------------------------------------------------------------
// Distractor selection
// ---------------------------------------------------------------------------

// Tunable weights — grouped for easy review.
// 問題１ (reading): kanji-overlap is the dominant confusability signal (words sharing a
//   kanji are the classic JLPT mix-up), with reading similarity as a secondary signal.
const READING_KANJI_W = 0.65;
const READING_SIM_W = 0.35;

// 問題２ (writing): the student sees kana and must identify kanji, so phonetic similarity
//   is the primary confusability axis. Shared kanji is a bonus (makes wrong answers look
//   plausible visually alongside the correct one).
const WRITING_SIM_W = 0.7;
const WRITING_KANJI_W = 0.3;

const SHORTLIST_K = 10; // randomise among this many top-scoring candidates for variety

/**
 * Pick `n` reading distractors for 問題１. Scored by kanji overlap + reading similarity;
 * deduped by the `reading` field so no two options sound identical.
 *
 * Okurigana constraint: if the target expression ends with hiragana (e.g. 主に → に,
 * 食べる → べる), all distractor readings must end with the same suffix. Without this,
 * the visible hiragana in the underlined expression trivially eliminates options that
 * don't match — the student guesses by pattern, not by knowing the kanji. Falls back to
 * unconstrained selection when the pool is too small to fill `n` okurigana-matched slots.
 */
function pickReadingDistractors(target: PoolWord, pool: PoolWord[], n: number): PoolWord[] {
  const targetKanji = kanjiOf(target.expression);
  const okuri = okurigana(target.expression);

  const allEligible: { word: PoolWord; score: number }[] = [];
  for (const w of pool) {
    if (w.id === target.id) continue;
    if (w.reading === target.reading) continue; // second correct answer
    const score =
      READING_KANJI_W * jaccard(targetKanji, kanjiOf(w.expression)) +
      READING_SIM_W * readingSimilarity(target.reading, w.reading);
    allEligible.push({ word: w, score });
  }

  // Prefer candidates whose reading ends with the same okurigana as the target.
  const constrained = okuri ? allEligible.filter((e) => e.word.reading.endsWith(okuri)) : allEligible;
  const chosen = pickFromEligible(constrained, (w) => w.reading, n);

  // Supplement from the unconstrained pool if the constrained set was too small.
  if (chosen.length < n) {
    const usedReadings = new Set(chosen.map((w) => w.reading));
    const fill = pickFromEligible(
      allEligible.filter((e) => !usedReadings.has(e.word.reading)),
      (w) => w.reading,
      n - chosen.length,
    );
    chosen.push(...fill);
  }

  return chosen;
}

/**
 * Pick `n` writing distractors for 問題２. Scored primarily by reading similarity (same
 * sound → plausible kanji mix-up) with a kanji-overlap bonus; deduped by `expression`.
 *
 * Okurigana constraint: if the target expression ends with hiragana (e.g. 食べる → べる),
 * all distractor expressions must end with the same suffix. Without this, the student can
 * eliminate options by checking whether the okurigana in the expression matches the kana
 * shown in the sentence — a pattern-match giveaway, not a vocabulary test.
 */
function pickWritingDistractors(target: PoolWord, pool: PoolWord[], n: number): PoolWord[] {
  const targetKanji = kanjiOf(target.expression);
  const okuri = okurigana(target.expression);

  const allEligible: { word: PoolWord; score: number }[] = [];
  for (const w of pool) {
    if (w.id === target.id) continue;
    if (w.expression === target.expression) continue; // second correct answer
    const score =
      WRITING_SIM_W * readingSimilarity(target.reading, w.reading) +
      WRITING_KANJI_W * jaccard(targetKanji, kanjiOf(w.expression));
    allEligible.push({ word: w, score });
  }

  // Prefer candidates whose expression ends with the same okurigana as the target.
  const constrained = okuri ? allEligible.filter((e) => e.word.expression.endsWith(okuri)) : allEligible;
  const chosen = pickFromEligible(constrained, (w) => w.expression, n);

  if (chosen.length < n) {
    const usedExprs = new Set(chosen.map((w) => w.expression));
    const fill = pickFromEligible(
      allEligible.filter((e) => !usedExprs.has(e.word.expression)),
      (w) => w.expression,
      n - chosen.length,
    );
    chosen.push(...fill);
  }

  return chosen;
}

/**
 * Shared selection logic: shortlist the top-K scorers, shuffle for variety, then sample
 * `n` with deduplication by `keyOf(w)`. Falls back to the full eligible set if the
 * shortlist runs dry before `n` is reached.
 */
function pickFromEligible(
  eligible: { word: PoolWord; score: number }[],
  keyOf: (w: PoolWord) => string,
  n: number,
): PoolWord[] {
  const shortlist = eligible
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, SHORTLIST_K)
    .map((e) => e.word);

  const seen = new Set<string>();
  const chosen: PoolWord[] = [];

  const take = (candidates: PoolWord[]) => {
    for (const w of candidates) {
      if (chosen.length === n) break;
      const key = keyOf(w);
      if (seen.has(key)) continue;
      seen.add(key);
      chosen.push(w);
    }
  };

  take(shuffle(shortlist));
  if (chosen.length < n) take(shuffle(eligible.map((e) => e.word)));

  return chosen;
}

// ---------------------------------------------------------------------------
// String / scoring helpers (duplicated from quiz.ts — see module header note)
// ---------------------------------------------------------------------------

/**
 * Extracts the okurigana — the hiragana suffix that follows the final kanji in a word.
 * e.g. 主に → "に", 食べる → "べる", 聞こえる → "こえる", 学校 → "", たべる → ""
 *
 * Returns "" when there is no trailing hiragana after a kanji (pure-kanji words like 学校,
 * or pure-kana words like たべる where no okurigana constraint is meaningful — the visible
 * hiragana IS the whole word, so there's nothing to constrain distractors on).
 */
function okurigana(expression: string): string {
  // Walk backwards collecting trailing hiragana.
  let i = expression.length - 1;
  while (i >= 0 && isHiragana(expression[i])) i--;
  // i is now pointing at the last non-hiragana character (or -1 if all hiragana).
  if (i < 0) return ""; // pure-kana expression — no meaningful okurigana
  if (!isKanji(expression[i])) return ""; // trailing hiragana not preceded by a kanji
  return expression.slice(i + 1); // the hiragana suffix
}

/** True if `ch` is a hiragana character (U+3041–U+3096). */
function isHiragana(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return c >= 0x3041 && c <= 0x3096;
}

/** True if `ch` is a CJK kanji (BMP Unified + Extension A). */
function isKanji(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return (c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf);
}

/** Distinct kanji (Han chars, BMP CJK Unified + Extension A) in a string. */
function kanjiOf(expression: string): Set<string> {
  return new Set(expression.match(/[一-鿿㐀-䶿]/g) ?? []);
}

/** Jaccard overlap of two sets: |A∩B| / |A∪B|, in [0,1]. Returns 0 when either set is empty. */
function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Reading similarity in [0,1] = 1 − (Levenshtein / longer length). */
function readingSimilarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 0 : 1 - levenshtein(a, b) / max;
}

/** Levenshtein edit distance, single-row DP. */
function levenshtein(a: string, b: string): number {
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  const curr = new Array<number>(n + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr.slice();
  }
  return prev[n];
}

/** Fisher–Yates shuffle (returns a new array; input untouched). */
function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** `n` random distinct elements from `arr`. */
function sample<T>(arr: readonly T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}
