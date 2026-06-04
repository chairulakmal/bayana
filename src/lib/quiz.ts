// Duolingo-mode question builder (SPEC §8.2, §8.5).
//
// MVP: pick N random words from a JLPT level; each becomes a JP→EN question — show the
// expression (kanji if present) and have the user choose the English meaning — with three
// random same-level distractors. Non-scheduling: this only *reads* words, it never touches
// FSRS state (the Anki↔Duolingo "synergy" is deferred; SPEC §8.2, §15).
//
// The interesting seam is `pickDistractors`: today it's random (plus a correctness guard).
// Swapping in confusability scoring later — shared kanji / similar reading / overlapping
// meaning (SPEC §8.2) — means changing only that function, not the question/endpoint shape.

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

/**
 * Choose `n` distractors for `target` from the same-level pool.
 *
 * MVP = random, with the **fairness guard** that matters even when random: never pick a
 * word whose meaning equals the target's (that would make the question have two right
 * answers), and never repeat a meaning across options. This is SPEC §8.2's guardrail in
 * minimal form; full confusability scoring (shared kanji / reading similarity) slots in
 * here later without changing anything above.
 */
function pickDistractors(target: PoolWord, pool: PoolWord[], n: number): PoolWord[] {
  const seen = new Set<string>([normalizeMeaning(target.meaning)]);
  const chosen: PoolWord[] = [];
  for (const w of shuffle(pool)) {
    if (w.id === target.id) continue;
    const m = normalizeMeaning(w.meaning);
    if (seen.has(m)) continue; // skip a synonym of the target or a duplicate of a pick
    seen.add(m);
    chosen.push(w);
    if (chosen.length === n) break;
  }
  return chosen;
}

/** Compare meanings case-insensitively so "Vocabulary" and "vocabulary" don't both appear. */
function normalizeMeaning(meaning: string): string {
  return meaning.trim().toLowerCase();
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
