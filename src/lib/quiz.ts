// Quiz mode question builder (SPEC §8.2, §8.5).
//
// Pick N random words from a JLPT level; each becomes a JP→EN question — show the
// expression (kanji if present) and have the user choose the English meaning — with three
// *confusability-scored* same-level distractors (see `pickDistractors`). Non-scheduling:
// this only *reads* words, it never touches FSRS state (the Flashcard↔Quiz "synergy" is
// deferred; SPEC §8.2, §15).
//
// As the earlier MVP promised, confusability scoring dropped in by changing only
// `pickDistractors` — the question shape and the endpoint are untouched.

import { db } from "@/lib/db";
import type { Level } from "@/generated/prisma/enums";

export type QuizOption = { meaning: string; correct: boolean };

export type QuizQuestion = {
  wordId: string;
  expression: string; // the prompt — kanji form if the word has one
  reading: string; // revealed with the answer
  sentence: { japanese: string; reading: string; english: string } | null; // shown on reveal
  options: QuizOption[]; // 4, shuffled, exactly one `correct`
};

type PoolWord = { id: string; expression: string; reading: string; meaning: string };

const OPTIONS_PER_QUESTION = 4;

/**
 * Build up to `count` distinct questions for `level`. Returns `[]` if the level has too
 * few words to form even one question.
 */
export async function buildQuiz(level: Level, count: number): Promise<QuizQuestion[]> {
  // One cheap fetch of the level's pool (~700–2,700 rows) — used both to choose targets
  // and to draw distractors. Sentences are fetched separately, only for the chosen targets.
  const pool: PoolWord[] = await db.word.findMany({
    where: { level },
    select: { id: true, expression: true, reading: true, meaning: true },
  });
  if (pool.length < OPTIONS_PER_QUESTION) return [];

  const targets = sample(pool, Math.min(count, pool.length));

  // Fetch the targets' cached example sentences in one query, keyed by wordId for lookup.
  const sentences = await db.exampleSentence.findMany({
    where: { wordId: { in: targets.map((t) => t.id) } },
    select: { wordId: true, japanese: true, reading: true, english: true },
  });
  const sentenceByWord = new Map(
    sentences.map((s) => [s.wordId, { japanese: s.japanese, reading: s.reading, english: s.english }]),
  );

  return targets.map((target) => {
    const distractors = pickDistractors(target, pool, OPTIONS_PER_QUESTION - 1);
    const options = shuffle<QuizOption>([
      { meaning: target.meaning, correct: true },
      ...distractors.map((d) => ({ meaning: d.meaning, correct: false })),
    ]);
    return {
      wordId: target.id,
      expression: target.expression,
      reading: target.reading,
      sentence: sentenceByWord.get(target.id) ?? null,
      options,
    };
  });
}

// --- Confusability scoring (SPEC §8.2) ---------------------------------------
//
// Distractors are chosen to be *confusable* with the target so the quiz tests real recall,
// not elimination. Confusability blends two signals, both computable from data we already
// have (no schema change):
//
//   • shared kanji   — the strongest JLPT mix-up (生活 vs 学生 vs 生まれる all share 生)
//   • similar reading — phonetic near-misses (聞く kiku vs 効く kiku)
//
// Meaning is deliberately NOT a positive signal: preferring similar meanings would surface
// options that are *also arguably correct* (big/large) — unfair, not hard. Instead meaning
// is a GUARD: reject candidates whose gloss overlaps the target's too much, beyond the
// exact-match dedupe. (Author decision, 2026-06-04 §16: kanji+reading signals, meaning as a
// guard; shortlist the most confusable then pick at random for variety.)

// Tunable knobs — grouped so difficulty/variety is easy to adjust and review.
const KANJI_WEIGHT = 0.65; // shared kanji dominates (strongest confusable signal)
const READING_WEIGHT = 0.35; // reading similarity breaks ties / carries kana-only words
const SHORTLIST_K = 10; // randomise among this many of the most-confusable candidates
const MEANING_GUARD_JACCARD = 0.5; // reject a distractor whose gloss tokens overlap ≥ this

/**
 * Choose `n` confusable distractors for `target` from the same-level pool.
 *
 * Guarantees (unchanged from the MVP): never the target, never two options with the same
 * meaning, never a near-duplicate of the target's meaning. Added: picks are the most
 * kanji/reading-confusable words available, sampled from the top `SHORTLIST_K` for variety,
 * with a random fallback when confusable candidates run out (so a full question always builds).
 */
function pickDistractors(target: PoolWord, pool: PoolWord[], n: number): PoolWord[] {
  const targetKanji = kanjiOf(target.expression);
  const targetMeaningTokens = meaningTokens(target.meaning);
  const targetMeaning = normalizeMeaning(target.meaning);

  // Eligible = passes the fairness guards, scored for confusability.
  const eligible: { word: PoolWord; score: number }[] = [];
  for (const w of pool) {
    if (w.id === target.id) continue;
    if (normalizeMeaning(w.meaning) === targetMeaning) continue; // would be a 2nd right answer
    if (meaningTooClose(targetMeaningTokens, meaningTokens(w.meaning))) continue; // near-synonym guard
    const score =
      KANJI_WEIGHT * jaccard(targetKanji, kanjiOf(w.expression)) +
      READING_WEIGHT * readingSimilarity(target.reading, w.reading);
    eligible.push({ word: w, score });
  }

  // Shortlist the most confusable (score > 0 ⇒ it actually shares a kanji or sounds alike),
  // then randomise within it. Score-0 words are effectively random, so they sit in the fallback.
  const shortlist = eligible
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, SHORTLIST_K)
    .map((e) => e.word);

  const seen = new Set<string>([targetMeaning]);
  const chosen: PoolWord[] = [];
  const take = (candidates: PoolWord[]) => {
    for (const w of candidates) {
      if (chosen.length === n) break;
      const m = normalizeMeaning(w.meaning);
      if (seen.has(m)) continue; // keep every option's meaning distinct
      seen.add(m);
      chosen.push(w);
    }
  };

  take(shuffle(shortlist)); // confusable picks first…
  if (chosen.length < n) take(shuffle(eligible.map((e) => e.word))); // …random fallback to fill

  return chosen;
}

// --- string / meaning helpers ------------------------------------------------

/** Compare meanings case-insensitively so "Vocabulary" and "vocabulary" don't both appear. */
function normalizeMeaning(meaning: string): string {
  return meaning.trim().toLowerCase();
}

/** Distinct kanji (Han chars) in a string; kana/punctuation ignored. Empty for kana-only words.
 *  Explicit BMP ranges (CJK Unified + Extension A) avoid needing the regex `u`-flag/ES2018. */
function kanjiOf(expression: string): Set<string> {
  return new Set(expression.match(/[一-鿿㐀-䶿]/g) ?? []);
}

/** Jaccard overlap of two sets: |A∩B| / |A∪B|, in [0,1]. Defined as 0 when either is empty. */
function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Reading similarity in [0,1] = 1 − (edit distance / longer length). Operates on kana chars. */
function readingSimilarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 0 : 1 - levenshtein(a, b) / max;
}

/** Levenshtein edit distance, single-row DP (cheap — readings are only a few characters). */
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

// English words too generic to signal a shared meaning (glosses are full of them).
const MEANING_STOPWORDS = new Set([
  "to", "a", "an", "the", "of", "be", "do", "in", "on", "at", "for", "with",
  "and", "or", "by", "as", "one's", "someone", "something", "sth", "sb", "etc",
]);

/** Content tokens of an English gloss: lowercased words, minus parentheticals and stopwords. */
function meaningTokens(meaning: string): Set<string> {
  const cleaned = meaning
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // drop "(...)" clarifications
    .replace(/[^a-z\s]/g, " "); // letters only (handles "/", ";", commas, "~", etc.)
  return new Set(cleaned.split(/\s+/).filter((t) => t && !MEANING_STOPWORDS.has(t)));
}

/**
 * Meaning guard: true when two glosses share enough content words to risk a second right
 * answer (e.g. "to look" vs "to look up"). Token-overlap only — it catches shared *words*,
 * not pure synonyms ("big"/"large"), which would need embeddings; that limit is accepted.
 */
function meaningTooClose(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false; // nothing to compare → leave to other guards
  return jaccard(a, b) >= MEANING_GUARD_JACCARD;
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

/** `n` random distinct elements. */
function sample<T>(arr: readonly T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}
